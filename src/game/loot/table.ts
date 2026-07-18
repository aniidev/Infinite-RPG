import type { PostgresClient } from "@/lib/db";
import type { Item } from "@/game/types";

// SWAPPABLE MODULE: loot generation. Milestone 1 rolls from the base (depth 0)
// item pool, with the number of drops scaling by enemy level. Replace freely
// with rarity tiers, weighted tables, unique drops, etc. — nothing in the
// crafting core depends on how loot is produced.
// `sql` is the postgres client (typed loosely — postgres.js query results are
// dynamically shaped).
type WeightedItem = Item & { weight: number };

// Weighted random pick: an item's `weight` is its relative chance (higher = more
// common). Clover is common, Light/Dark Energy are rare.
function weightedPick(pool: WeightedItem[]): WeightedItem {
  const total = pool.reduce((s, it) => s + Math.max(0, it.weight ?? 10), 0);
  if (total <= 0) return pool[Math.floor(Math.random() * pool.length)];
  let r = Math.random() * total;
  for (const it of pool) {
    r -= Math.max(0, it.weight ?? 10);
    if (r < 0) return it;
  }
  return pool[pool.length - 1];
}

export async function rollLoot(
  sql: PostgresClient,
  level: number
): Promise<Item[]> {
  // Only base items whose min_level has been reached can drop — this is how
  // Axe (lv 3+), Hammer (lv 5+) and the energies (lv 11+) are gated to later
  // levels. `weight` biases which of the eligible items is chosen.
  const pool = (await sql`
    select id, name, glyph, bg_glyph as "bgGlyph", element, kind, stats, depth, weight
    from items
    where depth = 0 and min_level <= ${level}
  `) as unknown as WeightedItem[];

  if (pool.length === 0) return [];

  // 1 drop at low levels, more as the enemy level rises.
  const dropCount = 1 + Math.floor(Math.random() * (1 + Math.floor(level / 2)));

  const drops: Item[] = [];
  for (let i = 0; i < dropCount; i++) {
    drops.push(weightedPick(pool));
  }
  return drops;
}
