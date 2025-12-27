import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        neon: {
          green: "#00ff00",
          cyan: "#00ffff",
          magenta: "#ff00ff",
          yellow: "#ffff00",
        },
      },
      fontFamily: {
        mono: ["var(--font-jetbrains-mono)", "monospace"],
      },
      animation: {
        "pulse-glow": "pulse-glow 2s ease-in-out infinite",
        blink: "blink 1s step-end infinite",
        "data-stream": "data-stream 3s linear infinite",
        "float": "float 6s ease-in-out infinite",
        "scan": "scan 8s linear infinite",
        "glitch": "glitch 0.3s ease-in-out infinite",
        "typewriter": "typewriter 3s steps(40) forwards",
        "fade-in-up": "fade-in-up 0.8s ease-out forwards",
        "code-rain": "code-rain 20s linear infinite",
        "orbit": "orbit 20s linear infinite",
      },
      keyframes: {
        "pulse-glow": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.5" },
        },
        blink: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0" },
        },
        "data-stream": {
          "0%": { backgroundPosition: "0% 0%" },
          "100%": { backgroundPosition: "100% 100%" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-20px)" },
        },
        scan: {
          "0%": { transform: "translateY(-100%)" },
          "100%": { transform: "translateY(100%)" },
        },
        glitch: {
          "0%": { transform: "translate(0)" },
          "20%": { transform: "translate(-2px, 2px)" },
          "40%": { transform: "translate(-2px, -2px)" },
          "60%": { transform: "translate(2px, 2px)" },
          "80%": { transform: "translate(2px, -2px)" },
          "100%": { transform: "translate(0)" },
        },
        typewriter: {
          "0%": { width: "0" },
          "100%": { width: "100%" },
        },
        "fade-in-up": {
          "0%": { opacity: "0", transform: "translateY(30px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "code-rain": {
          "0%": { transform: "translateY(-100%)" },
          "100%": { transform: "translateY(100vh)" },
        },
        orbit: {
          "0%": { transform: "rotate(0deg) translateX(100px) rotate(0deg)" },
          "100%": { transform: "rotate(360deg) translateX(100px) rotate(-360deg)" },
        },
      },
    },
  },
  plugins: [],
};
export default config;
