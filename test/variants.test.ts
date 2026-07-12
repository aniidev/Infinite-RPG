import { test } from "node:test";
import assert from "node:assert/strict";
import {
  insertUniqueVariant,
  normalize,
  stripNumeral,
  roman,
  power,
  isUniqueViolation,
  type VariantStore,
  type VariantRow,
} from "../src/lib/variants";
import type { CraftGenResult, Item, Stats } from "../src/game/types";

// In-memory VariantStore that mimics the DB contract: unique `name_key`.
// insertVariant throws a 23505-shaped error on a name_key collision, exactly
// like Postgres would.
function makeFakeStore() {
  const rows = new Map<string, Item>();
  let seq = 0;
  const store: VariantStore = {
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
      rows.set(v.nameKey, item);
      return item;
    },
  };
  return { store, rows };
}

function gen(name: string, stats: Partial<Stats> = {}): CraftGenResult {
  return {
    name,
    glyph: "🗡️",
    element: "fire",
    kind: "weapon",
    stats: { health: 0, attack: 0, defense: 0, luck: 0, ...stats },
  };
}

test("same base name, three recipes -> bare, II, III; stats stay parent-based (not inflated)", async () => {
  const { store, rows } = makeFakeStore();
  const g = gen("Fire Sword", { attack: 20, defense: 10 }); // power 30

  const a = await insertUniqueVariant(store, g, 1, "p1");
  const b = await insertUniqueVariant(store, g, 1, "p1");
  const c = await insertUniqueVariant(store, g, 1, "p1");

  assert.equal(a.name, "Fire Sword");
  assert.equal(b.name, "Fire Sword II");
  assert.equal(c.name, "Fire Sword III");

  // No rescaling: every variant keeps the crafted stats.
  assert.equal(power(a.stats), 30);
  assert.equal(power(b.stats), 30);
  assert.equal(power(c.stats), 30);

  // No two items share a name_key.
  assert.equal(rows.size, 3);
});

test("a weak craft colliding with a strong name keeps its OWN weak stats (the bug fix)", async () => {
  const { store } = makeFakeStore();

  // A strong "Fire Sword" already exists (e.g. a deep craft).
  await insertUniqueVariant(store, gen("Fire Sword", { attack: 100 }), 8, "other"); // power 100

  // A low-level craft yields the same name. It must NOT be inflated to out-rank
  // the strong one — it becomes "Fire Sword II" with its own small stats.
  const weak = gen("Fire Sword", { attack: 5 }); // power 5
  const res = await insertUniqueVariant(store, weak, 1, "p1");

  assert.equal(res.name, "Fire Sword II");
  assert.equal(power(res.stats), 5); // exactly the crafted power, no inflation
});

test("an LLM-appended numeral still groups under the base name and keeps its stats", async () => {
  const { store } = makeFakeStore();

  await insertUniqueVariant(store, gen("Fire Sword", { attack: 30 }), 1, "p1");
  const res = await insertUniqueVariant(store, gen("Fire Sword II", { attack: 7 }), 1, "p1");

  assert.equal(res.name, "Fire Sword II");
  assert.equal(power(res.stats), 7);
});

test("helpers", () => {
  assert.equal(roman(1), "");
  assert.equal(roman(2), "II");
  assert.equal(roman(3), "III");
  assert.equal(roman(4), "IV");

  assert.equal(stripNumeral("Fire Sword III"), "Fire Sword");
  assert.equal(stripNumeral("Fire Sword"), "Fire Sword");
  assert.equal(stripNumeral("Excalibur"), "Excalibur"); // single word untouched

  assert.equal(normalize("  Fire   Sword "), "fire sword");

  assert.equal(power({ health: 1, attack: 2, defense: 3, luck: 4 }), 10);

  assert.ok(isUniqueViolation({ code: "23505" }));
  assert.ok(!isUniqueViolation({ code: "23502" }));
  assert.ok(!isUniqueViolation(new Error("nope")));
});
