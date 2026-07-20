import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ceilingFor,
  combinePower,
  statsFromShape,
  shapeFromStats,
  TIER_CEILINGS,
  RATE,
} from "../src/game/tiers";
import { power } from "../src/lib/variants";
import type { Stats, StatShape } from "../src/game/types";

test("ceilingFor follows 5*(t+1)^2 and is unbounded above", () => {
  assert.equal(ceilingFor(1), 20);
  assert.equal(ceilingFor(2), 45);
  assert.equal(ceilingFor(3), 80);
  assert.equal(ceilingFor(5), 180);
  assert.equal(ceilingFor(6), 245); // keeps climbing past the old tier-5 cap
  assert.equal(ceilingFor(7), 320);
  assert.equal(ceilingFor(0), 20); // clamped to the tier-1 minimum
});

test("combinePower: same-tier ascends when combined power meets the next ceiling", () => {
  // below threshold or different tiers -> outTier = max, no ascend
  assert.equal(combinePower(1, 10, 1, 10).outTier, 1); // combined 20 < 45
  assert.equal(combinePower(2, 10, 3, 8).outTier, 3);
  assert.equal(combinePower(3, 10, 1, 8).outTier, 3);
  assert.equal(combinePower(3, 30, 3, 30).outTier, 3); // combined 60 < 125
  // two tier-3s summing to >= ceilingFor(4)=125 ascend to tier 4, but land only
  // PART of the way in (offset toward the new ceiling), not at the full 125.
  const up = combinePower(3, 60, 3, 65);
  assert.equal(up.outTier, 4);
  assert.equal(up.target, 86); // 65 + (125-65)*0.35
  // two maxed tier-3s (80+80) ascend and land ~96, well under the 125 ceiling
  assert.equal(combinePower(3, 80, 3, 80).target, 96); // 80 + (125-80)*0.35
});

test("combinePower: pulls RATE toward the ceiling (diminishing returns)", () => {
  // base = max(7,6) = 7, ceiling = 20 -> 7 + (20-7)*0.35 = 11.55 -> 12
  assert.equal(combinePower(1, 7, 1, 6).target, 12);
  // next step from 12: 12 + (20-12)*0.35 = 14.8 -> 15 (smaller gain: diminishing)
  assert.equal(combinePower(1, 12, 1, 12).target, 15);
  // and again from 15: 15 + (20-15)*0.35 = 16.75 -> 17
  assert.equal(combinePower(1, 15, 1, 15).target, 17);

  const first = combinePower(1, 7, 1, 6).target - 7; // gain on first combine
  const second = combinePower(1, 12, 1, 12).target - 12; // gain on next
  assert.ok(second < first, "each combine should gain less than the previous");
});

test("combinePower: target never exceeds the OUTPUT tier's ceiling", () => {
  // sweep: whether it ascends or not, target stays within its result tier, and
  // the tier only ever goes up or stays the same.
  for (let tier = 1; tier <= 6; tier++) {
    for (let p = 0; p <= ceilingFor(tier) + 60; p += 7) {
      const r = combinePower(tier, p, tier, p);
      assert.ok(r.target <= ceilingFor(r.outTier));
      assert.ok(r.outTier >= tier);
    }
  }
});

test("statsFromShape: preserves shape and total equals target exactly", () => {
  const sword: StatShape = { attack: 8, defense: 2, health: 0, luck: 0 };
  const s = statsFromShape(sword, 20);
  assert.equal(power(s), 20); // exact total
  assert.ok(s.attack > s.defense); // still attack-heavy
  assert.equal(s.health, 0);
  assert.equal(s.luck, 0);

  // exact total across many targets and a lopsided shape
  const shape: StatShape = { attack: 5, defense: 3, health: 1, luck: 1 };
  for (const target of [1, 7, 12, 20, 45, 79, 180]) {
    assert.equal(power(statsFromShape(shape, target)), target);
  }
});

test("statsFromShape: empty shape dumps everything into attack", () => {
  const s = statsFromShape({ attack: 0, defense: 0, health: 0, luck: 0 }, 30);
  assert.equal(power(s), 30);
  assert.equal(s.attack, 30);
});

test("combining is never weaker than both parents in any stat", () => {
  // The result stats = the combine power spread across the parents' summed
  // profile. Since the combine total is always >= max(parent totals), each
  // result stat lands >= the minimum of the two parents' corresponding stat.
  const cases: Array<[Stats, Stats]> = [
    // two attack-heavy weapons -> result stays attack-strong (the reported bug)
    [{ attack: 12, defense: 1, health: 0, luck: 2 }, { attack: 10, defense: 2, health: 2, luck: 3 }],
    // weapon + armor -> hybrid, still not below both in any stat
    [{ attack: 14, defense: 1, health: 0, luck: 0 }, { attack: 0, defense: 12, health: 8, luck: 0 }],
    // identical items
    [{ attack: 9, defense: 3, health: 2, luck: 1 }, { attack: 9, defense: 3, health: 2, luck: 1 }],
  ];

  for (const [a, b] of cases) {
    const aPow = power(a);
    const bPow = power(b);
    const { target } = combinePower(1, aPow, 1, bPow);
    const result = statsFromShape(shapeFromStats(a, b), target);

    assert.equal(power(result), target); // exact total
    assert.ok(power(result) >= Math.max(aPow, bPow)); // never weaker overall

    const keys: (keyof Stats)[] = ["attack", "defense", "health", "luck"];
    for (const k of keys) {
      assert.ok(
        result[k] >= Math.min(a[k], b[k]),
        `stat ${k}: result ${result[k]} < min(${a[k]}, ${b[k]})`
      );
    }
    // the reported case: a strong-attack combine keeps a strong-attack result
    if (a.attack >= a.defense && b.attack >= b.defense) {
      assert.ok(result.attack >= Math.min(a.attack, b.attack));
    }
  }
});

test("sanity: constants are monotonic", () => {
  for (let i = 2; i < TIER_CEILINGS.length; i++) {
    assert.ok(TIER_CEILINGS[i] > TIER_CEILINGS[i - 1]);
  }
  assert.ok(RATE > 0 && RATE < 1);
});
