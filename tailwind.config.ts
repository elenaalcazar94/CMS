import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "sans-serif"],
      },
      colors: {
        brand: {
          50: "#f3f1ff", 100: "#e9e5ff", 200: "#d5ceff", 300: "#b6a6ff", 400: "#9175ff",
          500: "#7047ff", 600: "#5f2cf5", 700: "#5020d8", 800: "#421cb0", 900: "#381a8f",
        },
      },
      boxShadow: {
        card: "0 1px 2px rgba(16,24,40,.04), 0 1px 3px rgba(16,24,40,.06)",
        pop: "0 12px 32px -8px rgba(16,24,40,.18), 0 4px 8px -4px rgba(16,24,40,.08)",
      },
    },
  },
  plugins: [],
} satisfies Config;
