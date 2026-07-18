// FULL DB RESET — wipes everything (players, items, recipes, inventories) and
// re-seeds the world from scratch: base items, the hardcoded crafted items, and
// the hardcoded recipes. Use when you want a clean, deterministic starting world.
//
// Run with: npm run db:reset-db
// (Requires migrations to be applied first — needs items.min_level etc.)
import postgres from "postgres";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL is not set. Add it to .env.local.");
  process.exit(1);
}

const sql = postgres(connectionString, { prepare: false, max: 1 });

const normalize = (s) => s.trim().toLowerCase().replace(/\s+/g, " ");
const powerOf = (st) => st.health + st.attack + st.defense + st.luck;

// Base (depth 0) items — the ones that drop from battle. `minLevel` gates loot
// and `tier` sets the power ceiling. Higher-tier ingredients are gated to later
// levels, so the only way past a ceiling is to loot a tougher enemy: Axe (tier
// 2) from level 3, Hammer (tier 3) from level 5. Everything else is tier 1.
const baseItems = [
  { name: "Rusty Sword",   glyph: "🗡️", element: "none",  kind: "weapon",  stats: { health: 0, attack: 6, defense: 1, luck: 0 }, minLevel: 1, tier: 1 },
  { name: "Wooden Shield", glyph: "🛡️", element: "none",  kind: "armor",   stats: { health: 8, attack: 0, defense: 6, luck: 0 }, minLevel: 1, tier: 1 },
  { name: "Fire Shard",    glyph: "🔥", element: "fire",  kind: "element", stats: { health: 0, attack: 4, defense: 0, luck: 2 }, minLevel: 1, tier: 1 },
  { name: "Ice Shard",     glyph: "❄️", element: "ice",   kind: "element", stats: { health: 2, attack: 3, defense: 2, luck: 1 }, minLevel: 1, tier: 1 },
  { name: "Grass",         glyph: "🌿", element: "grass", kind: "misc",    stats: { health: 3, attack: 1, defense: 2, luck: 2 }, minLevel: 1, tier: 1 },
  { name: "Clover",        glyph: "🍀", element: "nature", kind: "misc",   stats: { health: 2, attack: 0, defense: 1, luck: 5 }, minLevel: 1, tier: 1, weight: 22 },
  { name: "Light Energy",  glyph: "🌟", bg: "☀️", element: "light", kind: "element", stats: { health: 3, attack: 6, defense: 2, luck: 6 }, minLevel: 11, tier: 3, weight: 3 },
  { name: "Dark Energy",   glyph: "🌑", bg: "🌌", element: "dark",  kind: "element", stats: { health: 4, attack: 8, defense: 4, luck: 2 }, minLevel: 11, tier: 3, weight: 3 },
  { name: "Axe",           glyph: "🪓", element: "none",  kind: "weapon",  stats: { health: 0, attack: 9, defense: 1, luck: 0 }, minLevel: 3, tier: 2 },
  { name: "Hammer",        glyph: "🔨", element: "none",  kind: "weapon",  stats: { health: 2, attack: 11, defense: 2, luck: 0 }, minLevel: 5, tier: 3 },
  // New drops — elemental (glyph differs from element, so they show the layered aura).
  { name: "Ember Dagger",  glyph: "🔪", element: "fire",   kind: "weapon", stats: { health: 0, attack: 6, defense: 0, luck: 3 }, minLevel: 2, tier: 1 },
  { name: "Frost Bow",     glyph: "🏹", element: "ice",    kind: "weapon", stats: { health: 0, attack: 8, defense: 1, luck: 3 }, minLevel: 3, tier: 2 },
  { name: "Storm Trident", glyph: "🔱", element: "storm",  kind: "weapon", stats: { health: 2, attack: 9, defense: 1, luck: 2 }, minLevel: 4, tier: 2 },
  { name: "Venom Blade",   glyph: "🗡️", element: "poison", kind: "weapon", stats: { health: 0, attack: 7, defense: 1, luck: 4 }, minLevel: 4, tier: 2 },
  { name: "Radiant Charm", glyph: "🔮", element: "light",  kind: "misc",   stats: { health: 4, attack: 2, defense: 4, luck: 8 }, minLevel: 6, tier: 3 },
];

// Hardcoded craft results (depth 1, tier 1). Seeded so the recipes below can
// point at them without calling the LLM. Powers fit under the tier-1 ceiling (20).
// `bg` is the layered background/aura emoji (what the LLM now supplies for real crafts).
const craftedItems = [
  { name: "Water",       glyph: "💧", bg: "🌊", element: "water", kind: "element", stats: { health: 6, attack: 3, defense: 5, luck: 2 }, tier: 1 },
  { name: "Fire Sword",  glyph: "⚔️", bg: "🔥", element: "fire",  kind: "weapon",  stats: { health: 0, attack: 12, defense: 1, luck: 2 }, tier: 1 },
  { name: "Ice Sword",   glyph: "🗡️", bg: "❄️", element: "ice",   kind: "weapon",  stats: { health: 2, attack: 10, defense: 2, luck: 3 }, tier: 1 },
  { name: "Fire Shield", glyph: "🛡️", bg: "🔥", element: "fire",  kind: "armor",   stats: { health: 8, attack: 3, defense: 7, luck: 2 }, tier: 1 },
  { name: "Ice Shield",  glyph: "🛡️", bg: "❄️", element: "ice",   kind: "armor",   stats: { health: 9, attack: 2, defense: 8, luck: 1 }, tier: 1 },
];

// [inputA, inputB, output]
const recipes = [
  ["Fire Shard", "Ice Shard", "Water"],
  ["Fire Shard", "Rusty Sword", "Fire Sword"],
  ["Ice Shard", "Rusty Sword", "Ice Sword"],
  ["Fire Shard", "Wooden Shield", "Fire Shield"],
  ["Ice Shard", "Wooden Shield", "Ice Shield"],
];

async function insertItem(it, depth) {
  const nameKey = normalize(it.name);
  const [row] = await sql`
    insert into items (name, name_key, base_key, glyph, bg_glyph, element, kind, stats, power, depth, min_level, tier, weight)
    values (${it.name}, ${nameKey}, ${nameKey}, ${it.glyph}, ${it.bg ?? null}, ${it.element}, ${it.kind}::item_kind,
            ${sql.json(it.stats)}, ${powerOf(it.stats)}, ${depth}, ${it.minLevel ?? 1}, ${it.tier ?? 1}, ${it.weight ?? 10})
    returning id
  `;
  return row.id;
}

try {
  await sql`truncate table players, items, recipes, player_inventory cascade`;

  const ids = new Map();
  for (const it of baseItems) ids.set(it.name, await insertItem(it, 0));
  for (const it of craftedItems) ids.set(it.name, await insertItem(it, 1));

  for (const [aName, bName, outName] of recipes) {
    const aId = ids.get(aName);
    const bId = ids.get(bName);
    const outId = ids.get(outName);
    // Same normalization /api/craft uses: sort the two ids, key = "min:max".
    const [min, max] = aId < bId ? [aId, bId] : [bId, aId];
    const key = `${min}:${max}`;
    await sql`
      insert into recipes (key, input_a_id, input_b_id, output_item_id)
      values (${key}, ${min}, ${max}, ${outId})
      on conflict (key) do nothing
    `;
  }

  const items = await sql`select name, depth, power, min_level, tier from items order by tier, depth, min_level, name`;
  console.log(`Seeded ${items.length} items:`);
  for (const r of items) {
    console.log(`  tier ${r.tier}  depth ${r.depth}  lv${r.min_level}+  power ${r.power}  ${r.name}`);
  }

  const recs = await sql`
    select a.name as a, b.name as b, o.name as o
    from recipes r
    join items a on a.id = r.input_a_id
    join items b on b.id = r.input_b_id
    join items o on o.id = r.output_item_id
    order by o.name
  `;
  console.log(`\nHardcoded recipes (${recs.length}):`);
  for (const r of recs) console.log(`  ${r.a} + ${r.b} = ${r.o}`);
} catch (err) {
  console.error("Reset failed:", err);
  process.exitCode = 1;
} finally {
  await sql.end();
}
