"use client";

import ItemGlyph from "./ItemGlyph";
import type { InventoryItem } from "@/game/types";

// ---------------------------------------------------------------------------
// Element map: drives the glyph-panel wash AND the card's left edge bar.
// The skill's canonical map is fire->ember, ice->steel, none->bone; extended
// here for the game's other elements. Add new elements HERE only, never inline.
// Class strings are literal so Tailwind keeps them.
// ---------------------------------------------------------------------------
const ELEMENT: Record<string, { wash: string; bar: string }> = {
  none: { wash: "wash-bone", bar: "border-l-bone" },
  fire: { wash: "wash-ember", bar: "border-l-ember" },
  ice: { wash: "wash-steel", bar: "border-l-steel" },
  water: { wash: "wash-steel", bar: "border-l-steel" },
  metal: { wash: "wash-steel", bar: "border-l-steel" },
  grass: { wash: "wash-moss", bar: "border-l-moss" },
  nature: { wash: "wash-moss", bar: "border-l-moss" },
  poison: { wash: "wash-moss", bar: "border-l-moss" },
  light: { wash: "wash-brass", bar: "border-l-brass" },
  holy: { wash: "wash-brass", bar: "border-l-brass" },
  lightning: { wash: "wash-brass", bar: "border-l-brass" },
  dark: { wash: "wash-bone", bar: "border-l-bone" },
};

function elementStyle(element: string): { wash: string; bar: string } {
  return ELEMENT[element.toLowerCase().trim()] ?? ELEMENT.none;
}

// Kind -> small monochrome ink icon shown in the glyph-panel corner. The FE0E
// variation selector forces text (non-emoji, single-color) rendering.
const KIND_ICON: Record<string, string> = {
  weapon: "⚔︎", // crossed swords
  armor: "⛨︎", // shield
  element: "✦", // star
  misc: "◆", // diamond
};

function kindIcon(kind: string): string {
  return KIND_ICON[kind.toLowerCase().trim()] ?? KIND_ICON.misc;
}

// The 3D emoji float above the flat paper world; knock them back into it.
// One place here, one in BattlePanel. Removable in one line.
const GLYPH_FILTER = { filter: "saturate(0.65) contrast(1.05) sepia(0.15)" } as const;

// Tier -> ink/brass border treatment (paired with the brass pips up top).
function tierOutline(tier: number): string {
  switch (Math.max(1, Math.min(5, tier))) {
    case 5:
      return "outline outline-[3px] outline-brass outline-offset-[-5px]";
    case 4:
      return "outline outline-2 outline-brass outline-offset-[-5px]";
    case 3:
      return "outline outline-2 outline-brass outline-offset-[-3px]";
    case 2:
      return "outline outline-1 outline-brass outline-offset-[-3px]";
    default:
      return "";
  }
}

export type ItemCardSize = "full" | "compact" | "tile";

interface ItemCardProps {
  item: InventoryItem;
  size?: ItemCardSize;
}

// Brass pips along the top edge encode tier (no bare number). Tier 1 shows none.
function TierPips({ tier }: { tier: number }) {
  const n = Math.max(1, Math.min(5, tier));
  if (n < 2) return null;
  return (
    <span className="pointer-events-none absolute left-1/2 top-0 z-10 flex -translate-x-1/2 -translate-y-1/2 gap-0.5">
      {Array.from({ length: n }).map((_, i) => (
        <span key={i} className="h-1.5 w-2 border border-ink bg-brass" />
      ))}
    </span>
  );
}

// Quantity marker, bottom-right, only when a stack holds more than one.
function QtyBadge({ quantity }: { quantity: number }) {
  if (quantity <= 1) return null;
  return (
    <span className="pointer-events-none absolute -bottom-1.5 -right-1.5 z-10 rounded-paper border-2 border-ink bg-stone-900 px-1 font-display text-[10px] leading-tight tabular-nums text-primary shadow-ink-sm">
      x{quantity}
    </span>
  );
}

// Glyph on its element-tinted panel, with a monochrome kind icon in the corner.
function GlyphPanel({
  item,
  box,
  glyphSize,
}: {
  item: InventoryItem;
  box: string;
  glyphSize: "sm" | "md" | "lg";
}) {
  const { wash } = elementStyle(item.element);
  return (
    <span
      className={`relative grid shrink-0 place-items-center rounded-paper border-2 border-ink ${wash} ${box}`}
    >
      <span style={GLYPH_FILTER}>
        <ItemGlyph element={item.element} glyph={item.glyph} bgGlyph={item.bgGlyph} size={glyphSize} />
      </span>
      <span className="absolute bottom-0 right-0.5 font-body text-[10px] leading-none text-ink">
        {kindIcon(item.kind)}
      </span>
    </span>
  );
}

// One stat on the inventory card: Cinzel caps label + tabular value. `align`
// pushes the pair to the left or right edge so the two columns flank the glyph.
function StatLine({
  label,
  value,
  align,
}: {
  label: string;
  value: number;
  align: "left" | "right";
}) {
  return (
    <div
      className={`flex items-baseline gap-1 whitespace-nowrap ${
        align === "right" ? "justify-end" : "justify-start"
      }`}
    >
      <span className="font-display text-[11px] tracking-wide text-secondary">{label}</span>
      <span className="font-body text-[16px] leading-none tabular-nums text-primary">{value}</span>
    </div>
  );
}

// Hover/tap tooltip: full name, the four stats (Cinzel caps labels, no emoji),
// element, kind, tier.
function StatsTooltip({ item }: { item: InventoryItem }) {
  const tier = item.tier ?? 1;
  return (
    <div className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 w-44 -translate-x-1/2 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
      <div className="rounded-paper border-2 border-ink bg-stone-900 px-2.5 py-2 text-center shadow-ink">
        <div className="font-display text-[12px] leading-tight text-primary">{item.name}</div>
        <div className="mt-0.5 font-body text-[10px] uppercase tracking-wide text-secondary">
          {item.element} · {item.kind} · tier {tier}
        </div>
        <div className="mt-2 grid grid-cols-4 gap-1 font-display text-[9px] tracking-wide text-secondary">
          <span>HP</span>
          <span>ATK</span>
          <span>DEF</span>
          <span>LCK</span>
        </div>
        <div className="grid grid-cols-4 gap-1 font-body text-[12px] tabular-nums text-primary">
          <span>{item.stats.health}</span>
          <span>{item.stats.attack}</span>
          <span>{item.stats.defense}</span>
          <span>{item.stats.luck}</span>
        </div>
      </div>
    </div>
  );
}

export default function ItemCard({ item, size = "full" }: ItemCardProps) {
  const tier = item.tier ?? 1;
  const { bar } = elementStyle(item.element);
  const power = item.power ?? 0;

  // Small square icon tile (kept for compatibility; glyph + hover tooltip).
  if (size === "tile") {
    return (
      <div className="group relative">
        <div
          className={`relative grid h-16 w-16 place-items-center rounded-paper border-2 border-ink border-l-4 ${bar} bg-stone-700 shadow-ink ${tierOutline(
            tier
          )}`}
        >
          <TierPips tier={tier} />
          <GlyphPanel item={item} box="h-11 w-11" glyphSize="sm" />
        </div>
        <StatsTooltip item={item} />
      </div>
    );
  }

  // Compact: horizontal, glyph + full (wrapping) name + power. Used in equip /
  // mixing slots and the drag overlay. Name is never truncated. No stack badge:
  // these slots hold a single staged unit.
  if (size === "compact") {
    return (
      <div className="group relative">
        <div
          className={`relative flex items-center gap-2 rounded-paper border-2 border-ink border-l-4 ${bar} bg-stone-700 p-1.5 shadow-ink ${tierOutline(
            tier
          )}`}
        >
          <TierPips tier={tier} />
          <GlyphPanel item={item} box="h-11 w-11" glyphSize="sm" />
          <div className="min-w-0 flex-1">
            <div className="font-display text-[11px] leading-tight tracking-wide text-primary">
              {item.name}
            </div>
            <div className="mt-0.5 font-display text-[13px] leading-none tabular-nums text-brass">
              {power}
            </div>
          </div>
        </div>
        <StatsTooltip item={item} />
      </div>
    );
  }

  // Full card (inventory, four per row). All four stats flank the glyph to fill
  // the side space: Health + Luck on the left, Attack + Defense on the right.
  // No hover tooltip here — every stat is already on the face.
  return (
    <div
      className={`press relative flex select-none flex-col items-center gap-1.5 rounded-paper border-2 border-ink border-l-4 ${bar} bg-stone-700 p-2.5 ${tierOutline(
        tier
      )}`}
    >
      <TierPips tier={tier} />
      <div className="flex w-full items-center justify-between gap-1">
        <div className="flex min-w-0 flex-col gap-1.5">
          <StatLine label="HP" value={item.stats.health} align="left" />
          <StatLine label="LCK" value={item.stats.luck} align="left" />
        </div>
        <GlyphPanel item={item} box="h-14 w-14" glyphSize="md" />
        <div className="flex min-w-0 flex-col gap-1.5">
          <StatLine label="ATK" value={item.stats.attack} align="right" />
          <StatLine label="DEF" value={item.stats.defense} align="right" />
        </div>
      </div>
      <div className="w-full text-center font-display text-[12px] leading-tight tracking-wide text-primary">
        {item.name}
      </div>
      <QtyBadge quantity={item.quantity} />
    </div>
  );
}
