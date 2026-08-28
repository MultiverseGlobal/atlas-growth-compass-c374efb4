import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{ts,tsx}", 
    "./components/**/*.{ts,tsx}", 
    "./app/**/*.{ts,tsx}", 
    "./src/**/*.{ts,tsx}"
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        background: "#07080d",
        foreground: "#f0f2f8",
        surface: {
          1: "rgba(14, 16, 24, 0.95)",
          2: "rgba(22, 25, 38, 0.9)",
          3: "rgba(32, 36, 54, 0.85)",
        },
        border: {
          subtle: "rgba(255,255,255,0.065)",
          strong: "rgba(255,255,255,0.14)",
        },
        brand: {
          50:  "#f5f3ff",
          100: "#ede9fe",
          200: "#ddd6fe",
          300: "#c4b5fd",
          400: "#a78bfa",
          500: "#8b5cf6",
          600: "#7c3aed",
          700: "#6d28d9",
          800: "#5b21b6",
          900: "#4c1d95",
        },
        neon: {
          cyan:    "#22d3ee",
          emerald: "#34d399",
          violet:  "#a78bfa",
          amber:   "#fbbf24",
          pink:    "#f472b6",
        },
        muted: "rgba(148, 163, 184, 1)",
      },
      fontFamily: {
        sans: ["Inter", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "sans-serif"],
        mono: ["JetBrains Mono", "Fira Code", "monospace"],
        display: ["Inter", "sans-serif"],
      },
      letterSpacing: {
        tightest: "-0.04em",
        tighter:  "-0.03em",
        tight:    "-0.02em",
      },
      fontSize: {
        "2xs": ["0.625rem", { lineHeight: "0.875rem" }],
      },
      boxShadow: {
        glow:         "0 0 40px -10px rgba(139, 92, 246, 0.4)",
        "glow-sm":    "0 0 20px -6px rgba(139, 92, 246, 0.3)",
        "glow-cyan":  "0 0 40px -10px rgba(34, 211, 238, 0.3)",
        "glow-em":    "0 0 30px -8px rgba(52, 211, 153, 0.3)",
        card:         "0 1px 3px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.06)",
        "card-hover": "0 8px 32px -8px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.1)",
      },
      backgroundImage: {
        "gradient-radial":   "radial-gradient(var(--tw-gradient-stops))",
        "noise":             "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.04'/%3E%3C/svg%3E\")",
      },
      animation: {
        "fade-in":      "fadeIn 0.25s ease-out",
        "slide-up":     "slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)",
        "pulse-slow":   "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "shimmer":      "shimmer 2s linear infinite",
      },
      keyframes: {
        fadeIn:  { from: { opacity: "0" }, to: { opacity: "1" } },
        slideUp: { from: { opacity: "0", transform: "translateY(8px)" }, to: { opacity: "1", transform: "translateY(0)" } },
        shimmer: { from: { backgroundPosition: "-200% 0" }, to: { backgroundPosition: "200% 0" } },
      },
    },
  },
  plugins: [],
};

export default config;
