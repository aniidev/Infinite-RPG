import { statsFromShape } from "@/game/tiers";
import type { CraftGenResult, Item, Stats, StatShape } from "@/game/types";

// Each new variant of a base name is at least this much stronger than the
// current strongest — bounded by the tier ceiling.
export const STEP = 15;

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

/** lowercase, trim, collapse internal whitespace to single spaces. */
export function normalize(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

// Matches a trailing roman-numeral token built only from I/V/X/L (covers 1..49).
// Excluding M/C/D avoids false positives on real words like "Mix".
const TRAILING_ROMAN = /^(?=[ivxl])(xl|x{0,3})(ix|iv|v?i{0,3})$/i;

/**
 * Remove a trailing roman-numeral token so a base name is always numeral-free,
 * even if the LLM appended one. Never empties the name.
 */
export function stripNumeral(s: string): string {
  const trimmed = s.trim();
  const lastSpace = trimmed.lastIndexOf(" ");
  if (lastSpace === -1) return trimmed;
  const last = trimmed.slice(lastSpace + 1);
  if (TRAILING_ROMAN.test(last)) {
    const base = trimmed.slice(0, lastSpace).trim();
    if (base) return base;
  }
  return trimmed;
}

const ROMAN_TABLE: ReadonlyArray<readonly [number, string]> = [
  [40, "XL"],
  [10, "X"],
  [9, "IX"],
  [5, "V"],
  [4, "IV"],
  [1, "I"],
];

/** Ordinal numeral for the nth variant. n=1 -> "" (bare), n=2 -> "II", etc. */
export function roman(n: number): string {
  if (n <= 1) return "";
  let num = n;
  let out = "";
  for (const [value, symbol] of ROMAN_TABLE) {
    while (num >= value) {
      out += symbol;
      num -= value;
    }
  }
  return out;
}

/** Total power = sum of the four stats. */
export function power(stats: Stats): number {
  return stats.health + stats.attack + stats.defense + stats.luck;
}

/** True for a Postgres unique-constraint violation (SQLSTATE 23505). */
export function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: unknown }).code === "23505"
  );
}

// ---------------------------------------------------------------------------
// Tier-bounded monotonic variant insertion
// ---------------------------------------------------------------------------

export interface VariantRow {
  name: string;
  nameKey: string;
  baseKey: string;
  glyph: string;
  bgGlyph: string; // "" when there is no background emoji
  element: string;
  kind: string;
  stats: Stats;
  power: number;
  tier: number;
  depth: number;
  discoveredBy: string;
}

export interface TopVariant {
  id: string;
  power: number;
  item: Item;
}

/**
 * Storage port. DB-agnostic so the insertion loop is unit-testable.
 */
export interface VariantStore {
  /** Strongest existing variant of a base name (null if none). */
  topVariant(baseKey: string): Promise<TopVariant | null>;
  /**
   * Insert one variant. MUST throw a Postgres unique violation (code 23505) when
   * `nameKey` is already taken — that thrown error drives numeral escalation.
   */
  insertVariant(row: VariantRow): Promise<Item>;
}

export interface InsertVariantParams {
  // Stat distribution to follow (the parents' combined profile) — NOT from the
  // LLM. Every minted power is spread across this so the result can't be weaker
  // than both parents in any stat.
  shape: StatShape;
  outTier: number;
  ceiling: number;
  target: number;
  depth: number;
  discoveredBy: string;
}

export interface InsertVariantResult {
  item: Item;
  minted: boolean; // true when a NEW item row was created (false = reused existing)
}

/**
 * Mint a monotonic variant of `gen`'s name, bounded by the tier ceiling.
 *
 * Reconciled invariants:
 * - Variants of a base name, ordered by numeral, are strictly increasing in
 *   power (each new one is forced strictly above the current max).
 * - No variant exceeds the tier ceiling (newPower is clamped to `ceiling`).
 * - If the current strongest variant is already AT/ABOVE the ceiling, nothing
 *   is minted — the recipe simply reuses that top variant.
 *
 * Race-safety (do NOT replace the insert/catch with a pre-check SELECT): the
 * unique index on name_key lets only one insert win a contested numeral; the
 * loser catches the violation, RE-READS the now-higher max, and is forced above
 * it (or reuses the top variant if the ceiling is now reached).
 */
export async function insertTierVariant(
  store: VariantStore,
  gen: CraftGenResult,
  params: InsertVariantParams
): Promise<InsertVariantResult> {
  const { shape, outTier, ceiling, target, depth, discoveredBy } = params;
  const base = stripNumeral(gen.name).trim();
  const baseKey = normalize(base);

  for (let n = 1; n < 50; n++) {
    const suffix = roman(n);
    const name = suffix === "" ? base : `${base} ${suffix}`;
    const nameKey = normalize(name);

    // Strongest existing variant of this base name (re-read every iteration so a
    // collision picks up the winner's row).
    const top = await store.topVariant(baseKey);
    const max = top?.power ?? 0;

    // Already maxed for this tier: do not mint — reuse the existing top variant.
    if (top && max >= ceiling) {
      return { item: top.item, minted: false };
    }

    // Force strictly above the current max, but never above the tier ceiling.
    const newPower = Math.min(ceiling, Math.max(target, max + STEP));
    const stats = statsFromShape(shape, newPower);

    try {
      const item = await store.insertVariant({
        name,
        nameKey,
        baseKey,
        glyph: gen.glyph,
        bgGlyph: gen.bgGlyph,
        element: gen.element,
        kind: gen.kind,
        stats,
        power: newPower,
        tier: outTier,
        depth,
        discoveredBy,
      });
      return { item, minted: true };
    } catch (err) {
      if (!isUniqueViolation(err)) throw err;
      // Name taken by a concurrent/prior insert: bump the numeral, recompute max.
    }
  }

  throw new Error("No free variant slot for base name.");
}
