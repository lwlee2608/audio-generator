import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        panel: "#ffffff",
        accent: "#355fd6",
        tone: "#1476a6"
      },
      fontFamily: {
        display: ["Fraunces", "serif"],
        body: ["Plus Jakarta Sans", "sans-serif"]
      }
    }
  },
  plugins: []
} satisfies Config;
