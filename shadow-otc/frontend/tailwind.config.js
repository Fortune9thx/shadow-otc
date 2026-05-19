/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      screens: {
        xs: "480px",   // custom xs breakpoint — used throughout components
      },
      colors: {
        emeraldPrimary: "#0B6B4B",
        emeraldDark:    "#084C38",
        graphite:       "#0F1412",
        textPrimary:    "#1B1F1D",
        textSecondary:  "#51605A",
        textMuted:      "#7B8A84",
      },
      backgroundImage: {
        "shadow-otc-canvas": [
          "radial-gradient(circle at 15% 20%, rgba(11,107,75,0.10), transparent 40%)",
          "radial-gradient(circle at 85% 30%, rgba(0,0,0,0.08), transparent 50%)",
          "radial-gradient(circle at 50% 80%, rgba(11,107,75,0.06), transparent 60%)",
          "linear-gradient(180deg, #E6EBE9 0%, #DDE3E0 100%)",
        ].join(","),
      },
      boxShadow: {
        "card":       "0 1px 0 rgba(0,0,0,0.04), 0 8px 24px rgba(0,0,0,0.06)",
        "card-hover": "0 1px 0 rgba(0,0,0,0.06), 0 12px 32px rgba(0,0,0,0.10)",
        "em-glow":    "0 0 0 1px rgba(11,107,75,0.30), 0 4px 12px rgba(11,107,75,0.12)",
        "em-btn":     "0 4px 12px rgba(11,107,75,0.15)",
        "input":      "inset 0 1px 2px rgba(0,0,0,0.06)",
      },
      borderColor: {
        em: "rgba(11,107,75,0.18)",
        "em-strong": "rgba(11,107,75,0.25)",
      },
    },
  },
  plugins: [],
};
