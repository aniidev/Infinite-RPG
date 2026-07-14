import { test } from "node:test";
import assert from "node:assert/strict";
import {
  insertTierVariant,
  normalize,
  stripNumeral,
  roman,
  power,
  isUniqueViolation,
  type VariantStore,
  type VariantRow,
} from "../src/lib/variants";
import type { CraftGenResult, Item, StatShape } from "../src/game/types";

// In-memory VariantStore mimicking the DB contract: unique `name_key`, and a
// `topVariant` = strongest existing variant of a base name. insertVariant throws
// a 23505-shaped error on a name_key collision, exactly like Postgres.
function makeFakeStore() {
  const rows = new Map<string, { item: Item; power: number; baseKey: string }>();
  let seq = 0;
  const store: VariantStore = {
    async topVariant(baseKey) {
      let best: { item: Item; power: number; baseKey: string } | null = null;
      for (const r of rows.values()) {
        if (r.baseKey === baseKey && (!best || r.power > best.power)) best = r;
      }
      return best ? { id: best.item.id, power: best.power, item: best.item } : null;
    },
    async insertVariant(v: VariantRow) {
      if (rows.has(v.nameKey)) {
        const err = new Error("duplicate key value violates unique constraint");
        (err as Error & { code: string }).code = "23505";
        throw err;
      }
      const item: Item = {
        id: `item_${++seq}`,
        name: v.name,
        glyph: v.glyph,
        element: v.element,
        kind: v.kind,
        stats: v.stats,
        depth: v.depth,
      };
      rows.set(v.nameKey, { item, power: v.power, baseKey: v.baseKey });
      return item;
    },
  };
  return { store, rows };
}

function gen(name: string): CraftGenResult {
  return { name, glyph: "🗡️", bgGlyph: "🔥", element: "fire", kind: "weapon" };
}

const params = (
  over: Partial<{ outTier: number; ceiling: number; target: number; shape: StatShape }> = {}
) => ({
  shape: { attack: 1, defense: 1, health: 1, luck: 1 } as StatShape,
  outTier: 1,
  ceiling: 20,
  target: 12,
  depth: 1,
  discoveredBy: "p1",
  ...over,
});

test("monotonic climb, then ceiling plateau with no-mint reuse", async () => {
  const { store, rows } = makeFakeStore();
  const g = gen("Fire Sword");

  const a = await insertTierVariant(store, g, params()); // max 0 -> 15
  const b = await insertTierVariant(store, g, params()); // max 15 -> 20 (ceiling)
  const c = await insertTierVariant(store, g, params()); // max 20 == ceiling -> reuse

  assert.equal(a.item.name, "Fire Sword");
  assert.equal(b.item.name, "Fire Sword II");
  assert.equal(a.minted, true);
  assert.equal(b.minted, true);

  assert.equal(power(a.item.stats), 15);
  assert.equal(power(b.item.stats), 20);
  assert.ok(power(a.item.stats) < power(b.item.stats)); // strictly increasing

  // Already maxed: no new row, reuse the strongest (the "II" at power 20).
  assert.equal(c.minted, false);
  assert.equal(c.item.name, "Fire Sword II");
  assert.equal(power(c.item.stats), 20);
  assert.equal(rows.size, 2);
});

test("never exceeds the tier ceiling even with an over-target", async () => {
  const { store } = makeFakeStore();
  const res = await insertTierVariant(store, gen("Blaze"), params({ target: 999 }));
  assert.equal(res.minted, true);
  assert.equal(power(res.item.stats), 20); // clamped to ceiling, not 999
});

test("higher tier: climbs by STEP and asymptotes at its ceiling, then stops minting", async () => {
  const { store, rows } = makeFakeStore();
  const g = gen("Storm Blade");
  const powers: number[] = [];
  let lastMinted = true;

  for (let i = 0; i < 7; i++) {
    const r = await insertTierVariant(store, g, params({ outTier: 3, ceiling: 80, target: 20 }));
    if (r.minted) powers.push(power(r.item.stats));
    lastMinted = r.minted;
  }

  // 20, 35, 50, 65, 80 — strictly increasing, none over the ceiling.
  assert.deepEqual(powers, [20, 35, 50, 65, 80]);
  for (let i = 1; i < powers.length; i++) assert.ok(powers[i] > powers[i - 1]);
  assert.ok(powers.every((p) => p <= 80));

  // Once at the ceiling, further combines reuse the top variant (no new rows).
  assert.equal(lastMinted, false);
  assert.equal(rows.size, 5);
});

test("collision escalates the numeral and stays under the ceiling", async () => {
  const { store } = makeFakeStore();

  // A concurrent/prior insert already claimed the bare name at power 15.
  await store.insertVariant({
    name: "Fire Sword",
    nameKey: "fire sword",
    baseKey: "fire sword",
    glyph: "🗡️",
    element: "fire",
    kind: "weapon",
    stats: { health: 4, attack: 5, defense: 3, luck: 3 }, // sum 15
    power: 15,
    tier: 1,
    depth: 1,
    discoveredBy: "other",
  });

  // n=1 (bare) collides -> unique violation -> escalate to II, forced above 15.
  const res = await insertTierVariant(store, gen("Fire Sword"), params());
  assert.equal(res.item.name, "Fire Sword II");
  assert.equal(res.minted, true);
  assert.equal(power(res.item.stats), 20);
  assert.ok(power(res.item.stats) <= 20);
});

test("minted stats always total exactly the assigned power and follow the shape", async () => {
  const { store } = makeFakeStore();
  const r = await insertTierVariant(store, gen("Frost Pike"), {
    ...params({ outTier: 2, ceiling: 45, target: 30 }),
    shape: { attack: 7, defense: 2, health: 1, luck: 0 },
  });
  assert.equal(power(r.item.stats), 30);
  assert.ok(r.item.stats.attack > r.item.stats.defense); // shape preserved
});

test("helpers", () => {
  assert.equal(roman(1), "");
  assert.equal(roman(2), "II");
  assert.equal(roman(3), "III");
  assert.equal(stripNumeral("Fire Sword III"), "Fire Sword");
  assert.equal(stripNumeral("Excalibur"), "Excalibur");
  assert.equal(normalize("  Fire   Sword "), "fire sword");
  assert.ok(isUniqueViolation({ code: "23505" }));
  assert.ok(!isUniqueViolation({ code: "23502" }));
});
