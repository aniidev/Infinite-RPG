import { getSql, type PostgresClient } from "./db";
import { withLock } from "./lock";
import { moderateName } from "./moderation";
import { generateCraft } from "./groq";
import { insertTierVariant, type VariantStore } from "./variants";
import { combinePower, shapeFromStats } from "@/game/tiers";
import { KINDS, MAX_INVENTORY_SLOTS, type Item } from "@/game/types";

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

// Item plus the fields the combine formula needs (read fresh from the DB).
type CraftItem = Item & { tier: number; power: number };

async function getItem(sql: PostgresClient, id: string): Promise<CraftItem | null> {
  const [row] = await sql`
    select id, name, glyph, bg_glyph as "bgGlyph", element, kind, stats, depth, tier, power
    from items where id = ${id}
  `;
  return row ? (row as CraftItem) : null;
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
  // lets many concurrent identical crafts share one LLM call / insert.
  const resolved = await withLock(key, () =>
    resolveRecipe(key, minId, maxId, itemA, itemB, playerId)
  );

  // Merging CONSUMES the two inputs and leaves only the result. Done atomically
  // so a failure can't drop an input or hand out a free craft.
  await sql.begin(async (tx) => {
    if (aId === bId) {
      await tx`
        update player_inventory set quantity = quantity - 2
        where player_id = ${playerId} and item_id = ${aId}
      `;
    } else {
      await tx`
        update player_inventory set quantity = quantity - 1
        where player_id = ${playerId} and item_id = ${aId}
      `;
      await tx`
        update player_inventory set quantity = quantity - 1
        where player_id = ${playerId} and item_id = ${bId}
      `;
    }

    // Remove fully-consumed stacks BEFORE adding the result, so a result that
    // happens to equal an input (e.g. fire + fire -> fire) is re-added correctly.
    await tx`
      delete from player_inventory
      where player_id = ${playerId} and quantity <= 0
    `;

    // Enforce the slot cap: a result that opens a NEW stack must fit. (Merges
    // usually free slots, so this only trips when both inputs were multi-stacks.)
    const [alreadyOwned] = await tx`
      select 1 from player_inventory
      where player_id = ${playerId} and item_id = ${resolved.item.id}
    `;
    if (!alreadyOwned) {
      const [countRow] = await tx`
        select count(*)::int as c from player_inventory where player_id = ${playerId}
      `;
      if (Number(countRow.c) >= MAX_INVENTORY_SLOTS) {
        throw new CraftError("Your inventory is full — make room before crafting.", 409);
      }
    }

    await tx`
      insert into player_inventory (player_id, item_id, quantity)
      values (${playerId}, ${resolved.item.id}, 1)
      on conflict (player_id, item_id)
      do update set quantity = player_inventory.quantity + 1
    `;
  });

  return resolved;
}

async function resolveRecipe(
  key: string,
  minId: string,
  maxId: string,
  itemA: CraftItem,
  itemB: CraftItem,
  playerId: string
): Promise<CraftResult> {
  const sql = getSql();

  // 2. Cache check.
  const [hit] = await sql`select output_item_id from recipes where key = ${key}`;
  if (hit) {
    const item = await getItem(sql, hit.output_item_id);
    if (item) return { item, discovered: false, cached: true };
  }

  // 3b. Miss -> ask the LLM for identity + shape ONLY (never power).
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
  const normGen = { ...gen, kind: normalizeKind(gen.kind) };

  // Power is computed locally from the tiers — capped by the tier ceiling.
  const { outTier, ceiling, target } = combinePower(
    itemA.tier,
    itemA.power,
    itemB.tier,
    itemB.power
  );

  // Distribute that power across the PARENTS' combined stat profile so the
  // result is never weaker than both parents in any stat.
  const shape = shapeFromStats(itemA.stats, itemB.stats);

  // 3d. Mint (or reuse) the tier-bounded variant, then upsert the recipe. If a
  // concurrent request already inserted this recipe, the ON CONFLICT no-ops and
  // we adopt the winner's item. First write wins.
  return await sql.begin(async (tx) => {
    // Tx-backed store. insertVariant runs in its own SAVEPOINT so a name-clash
    // unique violation rolls back only that attempt, letting the loop continue.
    const store: VariantStore = {
      async topVariant(baseKey) {
        const [row] = await tx`
          select id, name, glyph, bg_glyph as "bgGlyph", element, kind, stats, depth, power
          from items where base_key = ${baseKey}
          order by power desc limit 1
        `;
        if (!row) return null;
        return { id: row.id, power: Number(row.power), item: row as Item };
      },
      async insertVariant(v) {
        const rows = (await tx.savepoint(
          (sp) => sp`
            insert into items
              (name, name_key, base_key, glyph, bg_glyph, element, kind, stats, power, tier, depth, first_discovered_by)
            values (${v.name}, ${v.nameKey}, ${v.baseKey}, ${v.glyph}, ${v.bgGlyph || null},
                    ${v.element}, ${v.kind}::item_kind, ${sp.json(
                      v.stats as unknown as Record<string, number>
                    )}, ${v.power}, ${v.tier}, ${v.depth}, ${v.discoveredBy})
            returning id, name, glyph, bg_glyph as "bgGlyph", element, kind, stats, depth
          `
        )) as unknown as Item[];
        return rows[0];
      },
    };

    const { item, minted } = await insertTierVariant(store, normGen, {
      shape,
      outTier,
      ceiling,
      target,
      depth,
      discoveredBy: playerId,
    });

    const [recipeRow] = await tx`
      insert into recipes (key, input_a_id, input_b_id, output_item_id)
      values (${key}, ${minId}, ${maxId}, ${item.id})
      on conflict (key) do nothing
      returning key
    `;

    if (!recipeRow) {
      // Lost the race: adopt the winner's item. Only delete OUR row if we minted
      // a new one — a reused existing variant must never be deleted.
      const [existing] = await tx`select output_item_id from recipes where key = ${key}`;
      if (minted) {
        await tx`delete from items where id = ${item.id}`;
      }
      const [winner] = await tx`
        select id, name, glyph, bg_glyph as "bgGlyph", element, kind, stats, depth
        from items where id = ${existing.output_item_id}
      `;
      return { item: winner as Item, discovered: false, cached: false };
    }

    return { item, discovered: minted, cached: false };
  });
}
