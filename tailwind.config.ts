import type { Config } from "tailwindcss";

export default {
  darkMode: "class", // ← THIS is the key
  content: [
    "./index.html",
    "./src/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
} satisfies Config;
