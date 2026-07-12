import { NextResponse } from "next/server";
import { getSql } from "@/lib/db";
import { addToInventory } from "@/lib/inventory";
import { rollLoot } from "@/game/loot/table";
import { MAX_INVENTORY_SLOTS, type InventoryItem, type Item } from "@/game/types";

export const runtime = "nodejs";

// Called when the player defeats an enemy. Rolls loot from a table that scales
// with enemy level, adds it to the player's inventory, and returns the drops
// (aggregated by item so the client can show "x2" etc).
export async function POST(req: Request) {
  let playerId: unknown;
  let level: unknown;
  try {
    const body = await req.json();
    playerId = body?.playerId;
    level = body?.level;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  if (typeof playerId !== "string") {
    return NextResponse.json({ error: "Missing playerId." }, { status: 400 });
  }

  const enemyLevel = Math.max(1, Math.min(99, Math.floor(Number(level) || 1)));
  const sql = getSql();

  const drops = await rollLoot(sql, enemyLevel);

  // Respect the slot cap: drops that land on an existing stack always fit, but a
  // drop that would open a NEW stack is lost when the inventory is full.
  const existingRows = await sql`
    select item_id from player_inventory where player_id = ${playerId}
  `;
  const owned = new Set<string>(existingRows.map((r) => r.item_id as string));
  let stacks = owned.size;

  const added: Item[] = [];
  let lost = 0;
  for (const item of drops) {
    if (owned.has(item.id)) {
      await addToInventory(sql, playerId, item.id);
      added.push(item);
    } else if (stacks < MAX_INVENTORY_SLOTS) {
      await addToInventory(sql, playerId, item.id);
      owned.add(item.id);
      stacks += 1;
      added.push(item);
    } else {
      lost += 1;
    }
  }

  // Persist progression: the player has cleared this level, so next time they
  // resume at the following one. Never moves backward.
  const nextLevel = enemyLevel + 1;
  const [progressed] = await sql`
    update players set level = greatest(level, ${nextLevel})
    where id = ${playerId}
    returning level
  `;

  // Aggregate the added drops into { ...item, quantity }.
  const byId = new Map<string, InventoryItem>();
  for (const item of added) {
    const existing = byId.get(item.id);
    if (existing) {
      existing.quantity += 1;
    } else {
      byId.set(item.id, { ...item, quantity: 1 });
    }
  }

  return NextResponse.json({
    loot: Array.from(byId.values()),
    level: progressed?.level ?? nextLevel,
    lost,
  });
}
