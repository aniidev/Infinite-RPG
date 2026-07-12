import type { CraftGenResult, Item, Stats } from "@/game/types";

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

/** lowercase, trim, collapse internal whitespace to single spaces. */
export function normalize(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

// Matches a trailing roman-numeral token built only from I/V/X/L (covers 1..49,
// which is far more than enough). Excluding M/C/D avoids false positives on real
// words like "Mix" (M...) that happen to look roman-ish.
const TRAILING_ROMAN = /^(?=[ivxl])(xl|x{0,3})(ix|iv|v?i{0,3})$/i;

/**
 * Remove a trailing roman-numeral token so a base name is always numeral-free,
 * even if the LLM appended one. Never empties the name: a single-word input, or
 * a strip that would leave nothing, is returned unchanged.
 */
export function stripNumeral(s: string): string {
  const trimmed = s.trim();
  const lastSpace = trimmed.lastIndexOf(" ");
  if (lastSpace === -1) return trimmed; // single word: nothing to strip
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

/**
 * Ordinal numeral for the nth variant of a name. n=1 is the bare name (empty
 * suffix), n=2 -> "II", n=3 -> "III", etc. The numeral is purely a uniqueness
 * disambiguator — it does NOT imply anything about power.
 */
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

/** Total power = sum of the four stats (cached for convenience/queries). */
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
// Unique variant insertion
// ---------------------------------------------------------------------------

// The row we hand to the store. `stats` are exactly what the craft produced from
// its parents — never rescaled — and `power` is their cached sum.
export interface VariantRow {
  name: string;
  nameKey: string;
  baseKey: string;
  glyph: string;
  element: string;
  kind: string;
  stats: Stats;
  power: number;
  depth: number;
  discoveredBy: string;
}

/**
 * Storage port. Kept minimal and DB-agnostic so the insertion loop is
 * unit-testable and not coupled to postgres (or the LLM provider).
 */
export interface VariantStore {
  /**
   * Insert one variant. MUST throw a Postgres unique violation (code 23505) when
   * `nameKey` is already taken — that thrown error is what drives disambiguation.
   */
  insertVariant(row: VariantRow): Promise<Item>;
}

/**
 * Insert `gen` under its name, keeping its parent-derived stats intact. If the
 * name is already taken (by a prior or concurrent craft), append the next roman
 * numeral and retry — so distinct recipes that happen to yield the same name
 * ("Frostbite", "Frostbite II", ...) each keep their OWN sensible stats instead
 * of being inflated to out-rank an unrelated variant.
 *
 * Race-safety (do NOT replace the insert/catch with a pre-check SELECT — that
 * has a check-then-insert gap): the unique index on name_key lets only one
 * insert win a contested name; the loser catches the unique violation and takes
 * the next numeral.
 */
export async function insertUniqueVariant(
  store: VariantStore,
  gen: CraftGenResult,
  depth: number,
  discoveredBy: string
): Promise<Item> {
  const base = stripNumeral(gen.name).trim();
  const baseKey = normalize(base);
  const p = power(gen.stats);

  for (let n = 1; n < 50; n++) {
    const suffix = roman(n);
    const name = suffix === "" ? base : `${base} ${suffix}`;
    const nameKey = normalize(name);

    try {
      return await store.insertVariant({
        name,
        nameKey,
        baseKey,
        glyph: gen.glyph,
        element: gen.element,
        kind: gen.kind,
        stats: gen.stats, // parent-based; never rescaled
        power: p,
        depth,
        discoveredBy,
      });
    } catch (err) {
      if (!isUniqueViolation(err)) throw err;
      // Name taken by a prior or concurrent insert: bump the numeral and retry.
    }
  }

  throw new Error("No free variant slot for base name.");
}
