---
name: medieval-theme
description: The visual art direction for this game. Use whenever writing, restyling, or reviewing any UI, component, CSS, Tailwind config, or color choice in this project. Covers the dark medieval parchment palette, typography, texture, borders, shadows, and the anti-patterns that make UI read as futuristic instead of medieval.
---

# Dark Medieval Parchment Art Direction

The target look is a dark, moody medieval RPG with a hand-made paper feel, in the spirit of the old Cartoon Network Flash game Finn and Bones. Dark grey stone, aged parchment, heavy ink outlines, flat matte color, and visible paper grain. Think a candlelit dungeon rendered on worn paper, not a spaceship console.

## The core principle

Darkness is not what makes UI look futuristic. These five things are, and they are banned here:

1. Blue-tinted or neutral near-blacks (`#0A0A0F`, `#111827`, pure #000). Sci-fi greys are cold. Medieval greys are WARM: soot, stone, ash, wet slate with a brown or olive cast.
2. Gradients as fills. Especially two-color gradients on buttons, cards, or backgrounds.
3. Blurred glows and neon accents. No `box-shadow` with large blur and a saturated color, no `drop-shadow` glow, no bloom.
4. Glassmorphism. No `backdrop-blur`, no translucent frosted panels.
5. Geometric or grotesque sans fonts (Inter, Roboto, Space Grotesk) for display text.

If a change would introduce any of the above, do not make it.

## Palette

Define these as CSS variables in one place and use them everywhere. Never hardcode a hex outside the token file.

Stone (the dark base, warm not blue)

```
--stone-950: #14120F  /* deepest background, warm near-black */
--stone-900: #1C1A16  /* app background */
--stone-800: #262320  /* panel background */
--stone-700: #33302A  /* raised panel, card back */
--stone-600: #46413A  /* hover, subtle fill */
--stone-500: #5D574D  /* disabled text, dividers */
--ink:       #0D0C0A  /* outlines and borders, near-black warm */
```

Parchment (the paper surfaces)

```
--parchment-100: #EDE3C8  /* brightest paper, item card face */
--parchment-200: #E0D3B0  /* default paper */
--parchment-300: #CDBE96  /* aged paper, secondary surface */
--parchment-400: #B0A07C  /* paper edge, worn */
--ink-text:      #2A241A  /* text ON parchment, dark brown-black */
```

Text on stone

```
--text-primary:   #D8CFBA  /* warm off-white, NEVER pure #FFF */
--text-secondary: #9C9382
--text-muted:     #6E675B
```

Accents (muted, earthy, low saturation)

```
--rust:   #8C3A2B  /* danger, damage, HP */
--ember:  #C2571E  /* fire element */
--brass:  #B8873B  /* gold, rare, currency, highlights */
--moss:   #5A6B3F  /* healing, nature */
--steel:  #6E8494  /* ice element, cold metal */
--bone:   #C9BFA5  /* neutral element, misc */
```

Saturation rule: accents are muted and earthy. If a color looks like it could be an LED, desaturate it and shift it toward brown or olive.

Element mapping (drives the item card tint)

```
fire  -> --ember
ice   -> --steel
none  -> --bone
```

Add new elements to this map only, never inline.

## Typography

Two families, loaded from Google Fonts.

* Display (item names, headings, the attack button, numerals on cards): `Cinzel` (inscriptional Roman capitals, reads carved-in-stone medieval and stays legible). Use for short text only.
* Body (stats, descriptions, tooltips, UI labels): `EB Garamond` or `Lora`. Old-style serif, readable at small sizes.

Rules:

* Never use blackletter (Old English, UnifrakturMaguntia) for anything a player must read quickly. It is illegible at UI sizes. At most, it appears in a logo.
* Never use MedievalSharp or Papyrus. They read cheap and cartoonish.
* Display text gets slight positive letter-spacing (0.02em to 0.06em). Cinzel is all-caps by nature and needs the air.
* Stat numbers use tabular figures (`font-variant-numeric: tabular-nums`) so they do not jitter when values change.

## Texture (this is what creates the paper feel)

Paper grain is what separates this from "flat dark theme." Apply it.

* A subtle noise overlay across the whole app: an inline SVG `feTurbulence` (fractalNoise, baseFrequency around 0.8) as a fixed-position `pointer-events-none` layer at 4 to 7 percent opacity. One element at the app shell level.
* Parchment surfaces get their own faint grain plus a very slight warm inner darkening at the edges, so paper does not read as flat plastic.
* A soft vignette at the app shell corners (a large radial darkening at low opacity) to suggest candlelight. This is the ONE acceptable use of a gradient, and it must be a subtle black vignette, never a colored one.
* Optional: deckled or torn paper edges on parchment panels via `border-image` or a CSS mask. Nice to have, not required.

## Borders, corners, shadows

* Borders: 2px solid `--ink` on item cards and panels. Heavy ink outline is the signature of the style. 1px on minor dividers, using `--stone-600`.
* Corners: 2px to 4px radius. Slightly softened, never pill-shaped, never fully square. No `rounded-xl`, no `rounded-full` except on genuinely circular elements.
* Shadows: hard offset only. `box-shadow: 3px 3px 0 var(--ink)` style. No blur radius, no spread, no color other than ink at partial opacity. This gives the cut-paper, stacked-cardstock look.
* Raised state (hover): shift the element up and left by 1px and grow the hard shadow to 4px. Pressed: shift down and right, shrink shadow to 1px. This reads as physical paper, not a glowing button.

## Component notes

* Item card: parchment face, 2px ink border, hard ink shadow, element tint as a wash on the glyph area, tier shown as a border treatment (higher tier gets a `--brass` inner rule or a doubled ink border). Name in Cinzel, stats in EB Garamond with tabular numerals, all in `--ink-text` on the parchment.
* HP bars: flat `--rust` fill in an ink-outlined trough, no gradient, no glow, no rounded ends. Segment it with thin ink ticks if possible so it reads hand-drawn.
* Attack button: the loudest element on screen. Parchment or `--brass` face, thick ink border, hard shadow, Cinzel caps. It should look like a stamped seal or a wooden sign.
* Panels (battle, inventory, mixing, equipped): `--stone-800` with a 2px ink border, grain overlay, and a hard shadow to separate them from the `--stone-900` background.
* Empty slots (equip, mixing): recessed look via an INSET hard shadow and a darker `--stone-950` fill, so empty reads as a hole cut in the paper.

## Motion

Physical and snappy, not smooth and floaty. Short durations (120ms to 180ms), ease-out. Things should feel like paper cards being slapped down. No slow fades, no easing curves that overshoot dreamily, no parallax.

## Verification checklist

Before finishing any UI work, confirm:

* No gradients except the single app-level vignette.
* No blurred or colored shadows anywhere. All shadows are hard ink offsets.
* No `backdrop-blur`.
* No pure white or pure black. No blue-tinted greys.
* All colors come from tokens, none hardcoded.
* Grain overlay is present at the app shell.
* Display text is Cinzel, body is the old-style serif, no sans anywhere.
* Borders on cards and panels are 2px ink.
* Corner radii are 4px or less.
