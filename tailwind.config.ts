import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        surface: "#0c0e1a",
        panel: "rgba(15, 18, 35, 0.65)",
        accent: "#00e5ff",
        secondary: "#e040fb",
        tone: "#76ff03",
        muted: "#8892b0"
      },
      fontFamily: {
        display: ["Space Grotesk", "sans-serif"],
        body: ["Inter", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"]
      },
      animation: {
        "glow-pulse": "glow-pulse 2s ease-in-out infinite",
        "spin-slow": "spin 8s linear infinite"
      },
      keyframes: {
        "glow-pulse": {
          "0%, 100%": { boxShadow: "0 0 20px rgba(0,229,255,0.3), 0 0 60px rgba(0,229,255,0.1)" },
          "50%": { boxShadow: "0 0 30px rgba(0,229,255,0.5), 0 0 80px rgba(0,229,255,0.2)" }
        }
      }
    }
  },
  plugins: []
} satisfies Config;
