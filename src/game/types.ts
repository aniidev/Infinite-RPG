// Shared domain types. `element` is an open string (infinite crafting can coin
// new elements); the arrays below are just the canonical known values.
export const ELEMENTS = ["none", "fire", "ice"] as const;
export const KINDS = ["weapon", "armor", "element", "misc"] as const;

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
  glyph: string;
  element: string;
  kind: string;
  stats: Stats;
  depth: number;
}

export interface InventoryItem extends Item {
  quantity: number;
}

// What the LLM is asked to produce for a new craft (no id/depth — those are
// assigned server-side).
export interface CraftGenResult {
  name: string;
  glyph: string;
  element: string;
  kind: string;
  stats: Stats;
}
