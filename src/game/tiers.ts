import type { Stats, StatShape } from "./types";

// ---------------------------------------------------------------------------
// Tier ceilings — the balancing core.
//
// Each tier has a maximum total power. Superlinear so higher tiers feel
// meaningfully stronger. Tune freely; keep monotonic increasing in tier.
// Index = tier: tier 1 -> 20, tier 2 -> 45, ...
//
// TODO(ascend): a future "ascend" action could spend a resource to bump a
// single item up one tier — a deliberate money sink. Left as a clean seam; the
// only thing it would change is an item's `tier` (and thus its ceiling).
// ---------------------------------------------------------------------------
export const TIER_CEILINGS = [0, 20, 45, 80, 125, 180];

export function ceilingFor(tier: number): number {
  const t = Math.max(1, Math.floor(tier));
  return TIER_CEILINGS[Math.min(t, TIER_CEILINGS.length - 1)];
}

// Fraction of the remaining gap to the ceiling closed per combine.
export const RATE = 0.35;

export interface CombineResult {
  outTier: number;
  ceiling: number;
  target: number;
}

/**
 * The combine formula. Power is derived here, never from the LLM.
 * - outTier = max(parent tiers): combining never raises tier.
 * - target pulls `RATE` of the way from the stronger parent toward the tier
 *   ceiling, clamped so it can never cross the ceiling (diminishing returns).
 */
export function combinePower(
  aTier: number,
  aPower: number,
  bTier: number,
  bPower: number
): CombineResult {
  const outTier = Math.max(aTier, bTier);
  const ceiling = ceilingFor(outTier);
  const base = Math.max(aPower, bPower);
  const target = Math.min(ceiling, base + (ceiling - base) * RATE);
  return { outTier, ceiling, target: Math.round(target) };
}

/**
 * The stat distribution a combine should follow: the element-wise SUM of the two
 * parents' stats. Distributing power across this shape guarantees the result is
 * never weaker than both parents in any stat — because the combine total is
 * always >= max(parent totals), each result stat ends up >= the min of the two
 * parents' corresponding stat.
 */
export function shapeFromStats(a: Stats, b: Stats): StatShape {
  return {
    attack: a.attack + b.attack,
    defense: a.defense + b.defense,
    health: a.health + b.health,
    luck: a.luck + b.luck,
  };
}

/**
 * Distribute a target total across a relative shape. Result is integer stats
 * whose sum EXACTLY equals `targetTotal`, preserving the shape as closely as
 * rounding allows.
 */
export function statsFromShape(shape: StatShape, targetTotal: number): Stats {
  const target = Math.max(0, Math.round(targetTotal));

  const weights = {
    attack: Math.max(0, shape.attack),
    defense: Math.max(0, shape.defense),
    health: Math.max(0, shape.health),
    luck: Math.max(0, shape.luck),
  };
  const sum = weights.attack + weights.defense + weights.health + weights.luck;

  // No shape to preserve — put everything into attack.
  if (sum <= 0) {
    return { attack: target, defense: 0, health: 0, luck: 0 };
  }

  const scale = target / sum;
  const stats: Stats = {
    attack: Math.max(0, Math.round(weights.attack * scale)),
    defense: Math.max(0, Math.round(weights.defense * scale)),
    health: Math.max(0, Math.round(weights.health * scale)),
    luck: Math.max(0, Math.round(weights.luck * scale)),
  };

  // Reconcile rounding drift so the total is exactly `target`, nudging the
  // largest-weighted stats first to preserve shape.
  const keys: (keyof Stats)[] = ["attack", "defense", "health", "luck"];
  const order = [...keys].sort((a, b) => weights[b] - weights[a]);
  let total = stats.attack + stats.defense + stats.health + stats.luck;
  let i = 0;
  while (total !== target && i < 10000) {
    const k = order[i % order.length];
    const delta = total < target ? 1 : -1;
    if (stats[k] + delta >= 0) {
      stats[k] += delta;
      total += delta;
    }
    i++;
  }
  return stats;
}

/**
 * Loot tier mapping: which tier an enemy of a given level drops. Higher bands =
 * higher tiers, so beating tougher enemies is the only way to loot higher tiers.
 *
 * SEAM: the seeded loot pool authors each base item's tier to match its
 * min_level band (Axe = tier 2 at lv 3+, Hammer = tier 3 at lv 5+). This
 * function documents that mapping and is the place to hook dynamic drop tiers.
 */
export function tierForLevel(level: number): number {
  if (level >= 9) return 5;
  if (level >= 7) return 4;
  if (level >= 5) return 3;
  if (level >= 3) return 2;
  return 1;
}
