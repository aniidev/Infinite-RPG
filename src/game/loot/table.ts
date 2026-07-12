import type { PostgresClient } from "@/lib/db";
import type { Item } from "@/game/types";

// SWAPPABLE MODULE: loot generation. Milestone 1 rolls from the base (depth 0)
// item pool, with the number of drops scaling by enemy level. Replace freely
// with rarity tiers, weighted tables, unique drops, etc. — nothing in the
// crafting core depends on how loot is produced.
// `sql` is the postgres client (typed loosely — postgres.js query results are
// dynamically shaped).
export async function rollLoot(
  sql: PostgresClient,
  level: number
): Promise<Item[]> {
  const pool = (await sql`
    select id, name, glyph, element, kind, stats, depth from items where depth = 0
  `) as unknown as Item[];

  if (pool.length === 0) return [];

  // 1 drop at low levels, more as the enemy level rises.
  const dropCount = 1 + Math.floor(Math.random() * (1 + Math.floor(level / 2)));

  const drops: Item[] = [];
  for (let i = 0; i < dropCount; i++) {
    drops.push(pool[Math.floor(Math.random() * pool.length)]);
  }
  return drops;
}
