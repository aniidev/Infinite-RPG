// Shared domain types. `element` is an open string (infinite crafting can coin
// new elements); the arrays below are just the canonical known values.
export const ELEMENTS = ["none", "fire", "ice"] as const;
export const KINDS = ["weapon", "armor", "element", "misc"] as const;

// Inventory capacity. A "slot" is one distinct item stack (a stack can hold
// multiple copies via quantity). New loot that would create a new stack is
// dropped when all slots are full.
export const MAX_INVENTORY_SLOTS = 16;

export type Kind = (typeof KINDS)[number];

export interface Stats {
  health: number;
  attack: number;
  defense: number;
  luck: number;
}

export interface Item {
  id: string;
  name: string;
  glyph: string; // foreground emoji (the item)
  bgGlyph?: string | null; // optional LLM-authored background/aura emoji
  element: string;
  kind: string;
  stats: Stats;
  depth: number;
  tier?: number; // read-only, for UI tier framing (defaults to 1 when absent)
  power?: number; // read-only, total power for the card's headline number
}

export interface InventoryItem extends Item {
  quantity: number;
}

// Relative weights describing how an item's power is distributed. The LLM
// returns a shape (not absolute stats); power is computed locally from tiers and
// then distributed across the shape.
export interface StatShape {
  attack: number;
  defense: number;
  health: number;
  luck: number;
}

// What the LLM is asked to produce for a new craft: IDENTITY only. It never sets
// power, stats, or even the stat distribution — the result's stats come from the
// parents' combined profile scaled by the tier formula, so a combine can never
// be weaker than both parents. id/depth/tier/power/stats are assigned server-side.
export interface CraftGenResult {
  name: string;
  glyph: string; // foreground emoji (the item itself)
  bgGlyph: string; // background/aura emoji shown large behind it ("" = none)
  element: string;
  kind: string;
}
