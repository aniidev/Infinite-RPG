import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "var(--ink)",
        "ink-text": "var(--ink-text)",
        stone: {
          950: "var(--stone-950)",
          900: "var(--stone-900)",
          800: "var(--stone-800)",
          700: "var(--stone-700)",
          600: "var(--stone-600)",
          500: "var(--stone-500)",
        },
        parchment: {
          100: "var(--parchment-100)",
          200: "var(--parchment-200)",
          300: "var(--parchment-300)",
          400: "var(--parchment-400)",
        },
        primary: "var(--text-primary)",
        secondary: "var(--text-secondary)",
        muted: "var(--text-muted)",
        rust: "var(--rust)",
        ember: "var(--ember)",
        brass: "var(--brass)",
        moss: "var(--moss)",
        steel: "var(--steel)",
        bone: "var(--bone)",
      },
      fontFamily: {
        // No geometric sans anywhere — default to the old-style serif.
        sans: ['"EB Garamond"', "Georgia", "serif"],
        body: ['"EB Garamond"', "Georgia", "serif"],
        display: ["Cinzel", "Georgia", "serif"],
      },
      boxShadow: {
        // Hard offset ink shadows only — no blur, no spread, no color but ink.
        ink: "3px 3px 0 0 var(--ink)",
        "ink-lg": "5px 5px 0 0 var(--ink)",
        "ink-sm": "1px 1px 0 0 var(--ink)",
        "ink-inset": "inset 2px 2px 0 0 var(--ink)",
      },
      borderRadius: {
        paper: "3px",
      },
      keyframes: {
        pulseGlow: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.45" },
        },
        shake: {
          "0%, 100%": { transform: "translateX(0)" },
          "20%": { transform: "translateX(-4px)" },
          "40%": { transform: "translateX(4px)" },
          "60%": { transform: "translateX(-3px)" },
          "80%": { transform: "translateX(3px)" },
        },
        shakeHard: {
          "0%, 100%": { transform: "translateX(0) rotate(0deg)" },
          "20%": { transform: "translateX(-9px) rotate(-3deg)" },
          "40%": { transform: "translateX(9px) rotate(3deg)" },
          "60%": { transform: "translateX(-6px) rotate(-2deg)" },
          "80%": { transform: "translateX(6px) rotate(2deg)" },
        },
        strikeRight: {
          "0%, 100%": { transform: "translateX(0) scale(1)" },
          "35%": { transform: "translateX(16px) scale(1.06)" },
          "65%": { transform: "translateX(8px) scale(1.03)" },
        },
        strikeLeft: {
          "0%, 100%": { transform: "translateX(0) scale(1)" },
          "35%": { transform: "translateX(-16px) scale(1.06)" },
          "65%": { transform: "translateX(-8px) scale(1.03)" },
        },
        block: {
          "0%, 100%": { transform: "translateX(0) scale(1)" },
          "30%": { transform: "translateX(-3px) scale(1.08)" },
          "60%": { transform: "translateX(3px) scale(1.04)" },
        },
        floatUp: {
          "0%": { opacity: "0", transform: "translateY(6px)" },
          "20%": { opacity: "1" },
          "100%": { opacity: "0", transform: "translateY(-24px)" },
        },
        lootFall: {
          "0%": { opacity: "0", transform: "translateY(-34px) scale(0.8)" },
          "18%": { opacity: "1" },
          "100%": { opacity: "0", transform: "translateY(96px) scale(1)" },
        },
        popIn: {
          "0%": { opacity: "0", transform: "scale(0.6)" },
          "60%": { transform: "scale(1.08)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
        badgePop: {
          "0%": { opacity: "0", transform: "scale(0.4) rotate(-8deg)" },
          "60%": { transform: "scale(1.15) rotate(3deg)" },
          "100%": { opacity: "1", transform: "scale(1) rotate(0deg)" },
        },
        // Snappy paper-handling wobble for the mixing indicator.
        mixWobble: {
          "0%, 100%": { transform: "rotate(-7deg)" },
          "50%": { transform: "rotate(7deg)" },
        },
      },
      animation: {
        pulseGlow: "pulseGlow 1.1s ease-in-out infinite",
        shake: "shake 0.3s ease",
        shakeHard: "shakeHard 0.4s ease",
        strikeRight: "strikeRight 0.28s ease-out",
        strikeLeft: "strikeLeft 0.28s ease-out",
        block: "block 0.28s ease-out",
        floatUp: "floatUp 0.5s ease-out forwards",
        lootFall: "lootFall 0.6s ease-in forwards",
        popIn: "popIn 0.18s ease-out",
        badgePop: "badgePop 0.24s ease-out",
        mixWobble: "mixWobble 0.32s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
