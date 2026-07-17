// Layered item art: a big, faded element emoji behind the item's own glyph.
// Purely emoji-based (no colors, no glow, no blur): the medieval theme forbids
// neon bloom, so the previous colored radial glow has been removed entirely.

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

function backgroundFor(element: string): string | null {
  const e = element.toLowerCase().trim();
  if (!e || e === "none") return null;
  return ELEMENT_BG[e] ?? "✨";
}

type Size = "sm" | "md" | "lg";

const SIZES: Record<Size, { box: string; bg: string; fg: string }> = {
  sm: {
    box: "h-8 w-8 text-2xl",
    bg: "scale-[1.5] -translate-x-[5px] -translate-y-[3px]",
    fg: "text-[17px] translate-x-[5px] translate-y-[3px]",
  },
  md: {
    box: "h-12 w-12 text-4xl",
    bg: "scale-[1.5] -translate-x-[6px] -translate-y-[4px]",
    fg: "text-3xl translate-x-[6px] translate-y-[4px]",
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
  bgGlyph?: string | null;
  size?: Size;
}

export default function ItemGlyph({ element, glyph, bgGlyph, size = "sm" }: ItemGlyphProps) {
  const bg = (bgGlyph && bgGlyph.trim()) || backgroundFor(element);
  const layered = !!bg && bg !== glyph;
  const s = SIZES[size];

  return (
    <span className={`relative inline-grid shrink-0 place-items-center leading-none ${s.box}`}>
      {layered && (
        <span aria-hidden className={`col-start-1 row-start-1 select-none opacity-35 ${s.bg}`}>
          {bg}
        </span>
      )}
      <span className={`col-start-1 row-start-1 select-none ${layered ? s.fg : ""}`}>{glyph}</span>
    </span>
  );
}
