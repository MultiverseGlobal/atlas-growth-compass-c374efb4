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
        background: "var(--pds-canvas)",
        foreground: "var(--pds-text-primary)",
        surface: {
          1: "var(--pds-surface-1)",
          2: "var(--pds-surface-2)",
          3: "var(--pds-surface-3)",
          4: "var(--pds-surface-4)",
        },
        border: {
          subtle: "var(--pds-border-subtle)",
          strong: "var(--pds-border-strong)",
        },
        muted: "var(--pds-text-muted)",
        accent: {
          DEFAULT: "var(--pds-accent)",
          dim: "var(--pds-accent-dim)",
          glow: "var(--pds-accent-glow)",
        },
        status: {
          success: "var(--pds-success)",
          warning: "var(--pds-warning)",
          danger: "var(--pds-danger)",
          info: "var(--pds-info)",
        }
      },
      fontFamily: {
        sans: ["Inter", "Arial", "Helvetica", "sans-serif"],
        display: ["Space Grotesk", "Impact", "Arial Black", "sans-serif"],
        mono: ["JetBrains Mono", "IBM Plex Mono", "monospace"],
      },
      boxShadow: {
        glow: "var(--pds-shadow-glow)",
        card: "var(--pds-shadow-sm)",
        "card-hover": "var(--pds-shadow-md)",
      },
      animation: {
        "fade-in": "fadeIn var(--pds-t-fast) var(--pds-ease-out)",
        "slide-up": "slideUp var(--pds-t-base) var(--pds-ease-spring)",
        "enter": "pds-slide-up-fade var(--pds-t-slow) var(--pds-ease-spring) both",
      },
      keyframes: {
        fadeIn: { from: { opacity: "0" }, to: { opacity: "1" } },
        slideUp: { from: { opacity: "0", transform: "translateY(12px) scale(0.98)" }, to: { opacity: "1", transform: "translateY(0) scale(1)" } },
      },
    },
  },
  plugins: [],
};

export default config;
