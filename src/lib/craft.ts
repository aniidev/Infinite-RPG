import { getSql, type PostgresClient } from "./db";
import { withLock } from "./lock";
import { moderateName } from "./moderation";
import { generateCraft } from "./groq";
import { addToInventory } from "./inventory";
import { KINDS, type Item } from "@/game/types";

// Typed error so the route can map to an HTTP status.
export class CraftError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.name = "CraftError";
    this.status = status;
  }
}

export interface CraftResult {
  item: Item;
  discovered: boolean; // true when this craft was resolved by calling the LLM
  cached: boolean; // true when served from the global recipe cache
}

function normalizeKind(kind: string): string {
  return (KINDS as readonly string[]).includes(kind) ? kind : "misc";
}

async function getItem(sql: PostgresClient, id: string): Promise<Item | null> {
  const [row] = await sql`
    select id, name, glyph, element, kind, stats, depth from items where id = ${id}
  `;
  return row ? (row as Item) : null;
}

/**
 * The core crafting flow. See /api/craft in the project brief:
 *   1. Normalize the pair into a stable key (minId:maxId).
 *   2. Cache check -> on hit, add to inventory and return (no LLM).
 *   3. On miss: single-flight lock -> generate -> moderate -> insert item +
 *      upsert recipe (UNIQUE on key => first write wins) -> add to inventory.
 */
export async function craft(
  playerId: string,
  aId: string,
  bId: string
): Promise<CraftResult> {
  const sql = getSql();

  // Ownership: you can only craft with items you actually hold. Combining an
  // item with itself needs two copies.
  if (aId === bId) {
    const [row] = await sql`
      select quantity from player_inventory
      where player_id = ${playerId} and item_id = ${aId}
    `;
    if (!row || Number(row.quantity) < 2) {
      throw new CraftError("You need two of that item to combine it with itself.");
    }
  } else {
    const owned = await sql`
      select item_id from player_inventory
      where player_id = ${playerId} and (item_id = ${aId} or item_id = ${bId})
    `;
    if (owned.length < 2) {
      throw new CraftError("You do not own both of those items.");
    }
  }

  const itemA = await getItem(sql, aId);
  const itemB = aId === bId ? itemA : await getItem(sql, bId);
  if (!itemA || !itemB) {
    throw new CraftError("One or both items do not exist.", 404);
  }

  // 1. Normalize the pair so order never matters.
  const [minId, maxId] = aId < bId ? [aId, bId] : [bId, aId];
  const key = `${minId}:${maxId}`;

  // 2 + 3. Recipe resolution is player-independent, so the single-flight lock
  // lets many concurrent identical crafts share one LLM call / insert. Each
  // waiter still adds the resulting item to its own inventory afterward.
  const resolved = await withLock(key, () =>
    resolveRecipe(key, minId, maxId, itemA, itemB, playerId)
  );

  await addToInventory(sql, playerId, resolved.item.id);
  return resolved;
}

async function resolveRecipe(
  key: string,
  minId: string,
  maxId: string,
  itemA: Item,
  itemB: Item,
  playerId: string
): Promise<CraftResult> {
  const sql = getSql();

  // 2. Cache check.
  const [hit] = await sql`select output_item_id from recipes where key = ${key}`;
  if (hit) {
    const item = await getItem(sql, hit.output_item_id);
    if (item) return { item, discovered: false, cached: true };
  }

  // 3b. Miss -> call the LLM.
  let gen = await generateCraft(itemA, itemB);

  // 3c. Moderation — nothing offensive can ever enter the global cache.
  if (!moderateName(gen.name).ok) {
    gen = await generateCraft(itemA, itemB); // regenerate once
    if (!moderateName(gen.name).ok) {
      throw new CraftError(
        "The forge produced something unspeakable. Try a different combination.",
        422
      );
    }
  }

  const depth = Math.max(itemA.depth, itemB.depth) + 1;
  const kind = normalizeKind(gen.kind);

  // 3d. Insert the item, then upsert the recipe. If a concurrent request (on
  // another instance) already inserted this recipe, the ON CONFLICT no-ops and
  // we adopt the winner's item, discarding our orphan. First write wins.
  return await sql.begin(async (tx) => {
    const [inserted] = await tx`
      insert into items (name, glyph, element, kind, stats, depth, first_discovered_by)
      values (${gen.name}, ${gen.glyph}, ${gen.element}, ${kind}::item_kind, ${tx.json(
        gen.stats as unknown as Record<string, number>
      )}, ${depth}, ${playerId})
      returning id, name, glyph, element, kind, stats, depth
    `;

    const [recipeRow] = await tx`
      insert into recipes (key, input_a_id, input_b_id, output_item_id)
      values (${key}, ${minId}, ${maxId}, ${inserted.id})
      on conflict (key) do nothing
      returning key
    `;

    if (!recipeRow) {
      // Lost the race: adopt the existing recipe's item, drop our orphan.
      const [existing] = await tx`select output_item_id from recipes where key = ${key}`;
      await tx`delete from items where id = ${inserted.id}`;
      const [winner] = await tx`
        select id, name, glyph, element, kind, stats, depth
        from items where id = ${existing.output_item_id}
      `;
      return { item: winner as Item, discovered: false, cached: false };
    }

    return { item: inserted as Item, discovered: true, cached: false };
  });
}
