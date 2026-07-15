import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
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
      },
      animation: {
        pulseGlow: "pulseGlow 1.1s ease-in-out infinite",
        shake: "shake 0.3s ease",
        shakeHard: "shakeHard 0.4s ease",
        strikeRight: "strikeRight 0.3s ease",
        strikeLeft: "strikeLeft 0.3s ease",
        block: "block 0.3s ease",
        floatUp: "floatUp 0.75s ease-out forwards",
        lootFall: "lootFall 1s ease-in forwards",
        popIn: "popIn 0.35s ease-out",
        badgePop: "badgePop 0.5s ease-out",
      },
    },
  },
  plugins: [],
};

export default config;
