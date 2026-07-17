// App-wide texture: a paper-grain noise overlay + a subtle candlelight vignette.
// Both are fixed, pointer-events-none, and mounted once at the app shell.
// The vignette is the ONE permitted gradient (subtle, ink-toned, never colored).

const NOISE_SVG =
  "<svg xmlns='http://www.w3.org/2000/svg' width='140' height='140'>" +
  "<filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='2' stitchTiles='stitch'/></filter>" +
  "<rect width='100%' height='100%' fill='#808080' filter='url(#n)'/></svg>";

const NOISE_URL = `url("data:image/svg+xml,${encodeURIComponent(NOISE_SVG)}")`;

export default function Grain() {
  return (
    <>
      {/* paper grain */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-[100] opacity-[0.07] mix-blend-overlay"
        style={{ backgroundImage: NOISE_URL, backgroundRepeat: "repeat", backgroundSize: "140px 140px" }}
      />
      {/* candlelight vignette (ink-toned, low opacity) */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-[100] opacity-60"
        style={{
          background:
            "radial-gradient(125% 105% at 50% 38%, transparent 55%, var(--ink) 118%)",
        }}
      />
    </>
  );
}
