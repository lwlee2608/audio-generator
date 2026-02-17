import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        panel: "#0e0b19",
        accent: "#f95d5d",
        tone: "#ffd36f"
      },
      fontFamily: {
        display: ["Bebas Neue", "sans-serif"],
        body: ["Manrope", "sans-serif"]
      }
    }
  },
  plugins: []
} satisfies Config;
