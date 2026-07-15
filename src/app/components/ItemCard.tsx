"use client";

import ItemGlyph from "./ItemGlyph";
import type { InventoryItem } from "@/game/types";

// ---------------------------------------------------------------------------
// Two visual systems drive cohesion:
//   1. ELEMENT -> color palette (card tint + label color). One place to edit.
//   2. TIER    -> frame (border/ring/accent). Higher tier reads as rarer.
// Add a new element by adding one row here.
// ---------------------------------------------------------------------------

interface ElementStyle {
  card: string; // gradient + border tint for the card body
  label: string; // element/kind label color
}

const ELEMENT_STYLES: Record<string, ElementStyle> = {
  none: { card: "from-slate-800/70 to-slate-900/70 border-slate-700", label: "text-slate-400" },
  fire: { card: "from-orange-950/60 to-red-950/40 border-orange-800/70", label: "text-orange-300" },
  ice: { card: "from-cyan-950/60 to-sky-950/40 border-cyan-800/70", label: "text-cyan-300" },
  water: { card: "from-blue-950/60 to-sky-950/40 border-blue-800/70", label: "text-blue-300" },
  grass: { card: "from-green-950/60 to-emerald-950/40 border-green-800/70", label: "text-green-300" },
  lightning: { card: "from-yellow-950/60 to-amber-950/40 border-yellow-800/70", label: "text-yellow-300" },
  thunder: { card: "from-yellow-950/60 to-amber-950/40 border-yellow-800/70", label: "text-yellow-300" },
  poison: { card: "from-lime-950/60 to-green-950/40 border-lime-800/70", label: "text-lime-300" },
  dark: { card: "from-violet-950/60 to-slate-950/50 border-violet-800/70", label: "text-violet-300" },
  shadow: { card: "from-violet-950/60 to-slate-950/50 border-violet-800/70", label: "text-violet-300" },
  light: { card: "from-amber-950/50 to-yellow-950/30 border-amber-700/70", label: "text-amber-200" },
};

const ELEMENT_FALLBACK: ElementStyle = {
  card: "from-fuchsia-950/50 to-purple-950/40 border-fuchsia-800/70",
  label: "text-fuchsia-300",
};

function elementStyle(element: string): ElementStyle {
  return ELEMENT_STYLES[element.toLowerCase().trim()] ?? ELEMENT_FALLBACK;
}

// Tier -> frame treatment. tierBadge color kept in the same family.
function tierFrame(tier: number): string {
  switch (Math.max(1, Math.min(5, tier))) {
    case 5:
      return "ring-2 ring-fuchsia-400/90 shadow-[0_0_12px_rgba(232,121,249,0.35)]";
    case 4:
      return "ring-2 ring-amber-400/85 shadow-[0_0_10px_rgba(251,191,36,0.3)]";
    case 3:
      return "ring-2 ring-violet-400/75";
    case 2:
      return "ring-1 ring-sky-400/70";
    default:
      return "ring-1 ring-slate-700";
  }
}

function tierBadgeClass(tier: number): string {
  switch (Math.max(1, Math.min(5, tier))) {
    case 5:
      return "bg-fuchsia-500/25 text-fuchsia-200";
    case 4:
      return "bg-amber-500/25 text-amber-200";
    case 3:
      return "bg-violet-500/25 text-violet-200";
    case 2:
      return "bg-sky-500/25 text-sky-200";
    default:
      return "bg-slate-700/60 text-slate-300";
  }
}

export type ItemCardSize = "full" | "compact" | "tile";

interface ItemCardProps {
  item: InventoryItem;
  size?: ItemCardSize;
}

export default function ItemCard({ item, size = "full" }: ItemCardProps) {
  const el = elementStyle(item.element);
  const tier = item.tier ?? 1;

  // A square icon tile. Shows only the glyph; the attributes appear on hover.
  if (size === "tile") {
    return (
      <div className="group relative">
        <div
          className={`grid h-14 w-14 place-items-center rounded-lg border bg-gradient-to-br ${el.card} ${tierFrame(tier)}`}
        >
          <ItemGlyph element={item.element} glyph={item.glyph} bgGlyph={item.bgGlyph} size="sm" />
        </div>
        <span
          className={`pointer-events-none absolute -right-1 -top-1 rounded px-1 text-[8px] font-bold ${tierBadgeClass(tier)}`}
        >
          {tier}
        </span>
        {/* attributes on hover */}
        <div className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-1.5 -translate-x-1/2 whitespace-nowrap opacity-0 transition duration-150 group-hover:opacity-100">
          <div className="rounded-lg border border-slate-700 bg-slate-900 px-2 py-1.5 text-center shadow-xl">
            <div className="text-[11px] font-semibold">{item.name}</div>
            <div className={`text-[9px] uppercase tracking-wide ${el.label}`}>
              {item.element} · {item.kind}
            </div>
            <div className="mt-1 flex justify-center gap-1.5 font-mono text-[10px] text-slate-200">
              <span>❤️{item.stats.health}</span>
              <span>⚔️{item.stats.attack}</span>
              <span>🛡️{item.stats.defense}</span>
              <span>🍀{item.stats.luck}</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (size === "compact") {
    return (
      <div
        className={`flex items-center gap-1.5 rounded-lg border bg-gradient-to-br p-1.5 ${el.card} ${tierFrame(tier)}`}
        title={item.name}
      >
        <ItemGlyph element={item.element} glyph={item.glyph} bgGlyph={item.bgGlyph} size="sm" />
        <div className="min-w-0 flex-1">
          <div className="truncate text-[11px] font-semibold leading-tight">{item.name}</div>
          <div className="mt-0.5 flex gap-1 font-mono text-[9px] text-slate-300">
            <span>⚔️{item.stats.attack}</span>
            <span>🛡️{item.stats.defense}</span>
            <span>❤️{item.stats.health}</span>
            <span>🍀{item.stats.luck}</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`select-none rounded-xl border bg-gradient-to-br p-2.5 shadow-lg ${el.card} ${tierFrame(tier)}`}
    >
      <div className="flex items-center gap-2">
        <ItemGlyph element={item.element} glyph={item.glyph} bgGlyph={item.bgGlyph} size="sm" />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold leading-tight">{item.name}</div>
          <div className={`truncate text-[10px] uppercase tracking-wide ${el.label}`}>
            {item.element} · {item.kind}
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <span className={`rounded px-1.5 py-0.5 text-[9px] font-bold ${tierBadgeClass(tier)}`}>
            T{tier}
          </span>
          {item.quantity > 1 && (
            <span className="rounded bg-slate-900/70 px-1.5 py-0.5 text-[10px] text-slate-300">
              ×{item.quantity}
            </span>
          )}
        </div>
      </div>

      <div className="mt-2 grid grid-cols-4 gap-1 text-center text-[10px] text-slate-200">
        <Stat icon="❤️" value={item.stats.health} />
        <Stat icon="⚔️" value={item.stats.attack} />
        <Stat icon="🛡️" value={item.stats.defense} />
        <Stat icon="🍀" value={item.stats.luck} />
      </div>
    </div>
  );
}

function Stat({ icon, value }: { icon: string; value: number }) {
  return (
    <div className="rounded bg-slate-950/40 py-0.5">
      <div>{icon}</div>
      <div className="font-mono">{value}</div>
    </div>
  );
}
