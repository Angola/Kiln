import type { Config } from "tailwindcss";

export default {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "../../packages/renderer-react/src/**/*.{ts,tsx}",
    "../../packages/renderer-react/dist/**/*.js",
  ],
  darkMode: "media",
  theme: { extend: {} },
  plugins: [],
} satisfies Config;
