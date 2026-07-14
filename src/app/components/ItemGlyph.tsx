// Layered item art: a big, faded element emoji in the back + the item's own
// glyph crisp in front, over a soft element-colored glow. Purely presentational
// and derived from the item's `element`, so it needs no schema/LLM/data changes.
// Items with element "none" (base weapons/armor) render as a single clean glyph.

// element -> big background emoji (the "aura"). Covers the canonical elements
// plus the ones the LLM commonly coins; unknown non-"none" elements get "✨".
const ELEMENT_BG: Record<string, string> = {
  fire: "🔥", flame: "🔥", ember: "🔥", inferno: "🔥", blaze: "🔥", lava: "🌋", magma: "🌋",
  ice: "❄️", frost: "❄️", snow: "❄️", frozen: "❄️", glacial: "❄️",
  water: "💧", aqua: "💧", ocean: "🌊", sea: "🌊", wave: "🌊", rain: "🌧️",
  grass: "🌿", nature: "🌿", plant: "🌿", leaf: "🌿", forest: "🌳", bloom: "🌸", flower: "🌸",
  steam: "💨", mist: "🌫️", fog: "🌫️", cloud: "☁️", wind: "🌀", air: "🌀",
  storm: "⛈️", tempest: "⛈️", lightning: "⚡", thunder: "⚡", electric: "⚡", energy: "⚡", spark: "⚡",
  earth: "🪨", rock: "🪨", stone: "🪨", metal: "⚙️", steel: "⚙️", iron: "⚙️",
  light: "🌟", holy: "🌟", radiant: "🌟", solar: "☀️", sun: "☀️",
  dark: "🌑", shadow: "🌑", night: "🌙", moon: "🌙", void: "🌌", cosmic: "🌌", star: "⭐",
  poison: "☠️", toxic: "☠️", venom: "🐍", acid: "🧪",
  magic: "✨", arcane: "✨", mystic: "✨", crystal: "💎", gem: "💎", diamond: "💎",
  blood: "🩸", death: "💀", spirit: "👻", ghost: "👻",
};

// element -> glow color (kept in the same family as the card text colors).
const ELEMENT_GLOW: Record<string, string> = {
  fire: "#fb923c", flame: "#fb923c", ember: "#fb923c", inferno: "#f97316", blaze: "#fb923c",
  lava: "#f97316", magma: "#f97316",
  ice: "#67e8f9", frost: "#67e8f9", snow: "#a5f3fc", frozen: "#67e8f9", glacial: "#67e8f9",
  water: "#7dd3fc", aqua: "#7dd3fc", ocean: "#38bdf8", sea: "#38bdf8", wave: "#38bdf8", rain: "#7dd3fc",
  grass: "#4ade80", nature: "#4ade80", plant: "#4ade80", leaf: "#4ade80", forest: "#22c55e",
  bloom: "#f472b6", flower: "#f472b6",
  storm: "#a5b4fc", tempest: "#a5b4fc", lightning: "#fde047", thunder: "#fde047",
  electric: "#fde047", energy: "#fde047", spark: "#fde047",
  earth: "#d6b98c", rock: "#d6b98c", stone: "#d6b98c", metal: "#cbd5e1", steel: "#cbd5e1", iron: "#cbd5e1",
  light: "#fef08a", holy: "#fef08a", radiant: "#fef08a", solar: "#fde047", sun: "#fde047",
  dark: "#a78bfa", shadow: "#a78bfa", void: "#818cf8", cosmic: "#818cf8",
  poison: "#a3e635", toxic: "#a3e635", venom: "#a3e635", acid: "#a3e635",
  magic: "#e879f9", arcane: "#e879f9", mystic: "#e879f9", crystal: "#f0abfc", gem: "#f0abfc",
};

function normalizeElement(element: string): string {
  return element.toLowerCase().trim();
}

function backgroundFor(element: string): string | null {
  const e = normalizeElement(element);
  if (!e || e === "none") return null;
  return ELEMENT_BG[e] ?? "✨";
}

function glowFor(element: string): string | null {
  const e = normalizeElement(element);
  if (!e || e === "none") return null;
  return ELEMENT_GLOW[e] ?? null;
}

type Size = "sm" | "lg";

const SIZES: Record<Size, { box: string; bg: string; fg: string }> = {
  // The two layers are OFFSET, not centered: the background element is scaled up
  // and nudged up-left, the foreground item glyph is kept smaller and nudged
  // down-right — so both are visible, like an emblem sitting on the aura. Tune
  // the `-translate`/`translate` values here to change the offset.
  sm: {
    box: "h-8 w-8 text-2xl",
    bg: "scale-[1.5] -translate-x-[5px] -translate-y-[3px]",
    fg: "text-[17px] translate-x-[5px] translate-y-[3px]",
  },
  lg: {
    box: "h-20 w-20 text-6xl",
    bg: "scale-[1.45] -translate-x-3 -translate-y-2",
    fg: "text-5xl translate-x-3 translate-y-2",
  },
};

interface ItemGlyphProps {
  element: string;
  glyph: string;
  // The LLM-authored background emoji, when present. Falls back to an
  // element-derived aura (for base/legacy items that have none).
  bgGlyph?: string | null;
  size?: Size;
}

export default function ItemGlyph({ element, glyph, bgGlyph, size = "sm" }: ItemGlyphProps) {
  // Prefer the item's own (LLM-authored, infinite) background emoji; otherwise
  // derive one from the element.
  const bg = (bgGlyph && bgGlyph.trim()) || backgroundFor(element);
  const glow = glowFor(element);
  const layered = !!bg && bg !== glyph;
  const s = SIZES[size];

  return (
    <span className={`relative inline-grid shrink-0 place-items-center leading-none ${s.box}`}>
      {glow && (
        <span
          aria-hidden
          className="col-start-1 row-start-1 h-full w-full rounded-full opacity-50 blur-md"
          style={{ background: `radial-gradient(circle, ${glow} 0%, transparent 50%)` }}
        />
      )}
      {layered && (
        <span aria-hidden className={`col-start-1 row-start-1 select-none opacity-55 ${s.bg}`}>
          {bg}
        </span>
      )}
      <span
        className={
          "col-start-1 row-start-1 select-none " +
          (layered ? `${s.fg} drop-shadow-[0_1px_2px_rgba(0,0,0,0.7)]` : "")
        }
      >
        {glyph}
      </span>
    </span>
  );
}
