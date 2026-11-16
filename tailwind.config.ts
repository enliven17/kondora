import type { Config } from "tailwindcss";

/** Colors map to CSS variables in app/globals.css (space separated RGB channels). */
const token = (name: string) => `rgb(var(--${name}) / <alpha-value>)`;

const config: Config = {
  content: ["./app/**/*.{ts,tsx,mdx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}", "./hooks/**/*.{ts,tsx}"],
  theme: {
    screens: {
      xs: "400px",
      sm: "640px",
      md: "768px",
      lg: "1024px",
      xl: "1280px",
      "2xl": "1536px",
    },
    /* No "full" radius on purpose: Kondora has no pill shapes. */
    borderRadius: {
      none: "0",
      xs: "2px",
      sm: "4px",
      DEFAULT: "4px",
      md: "6px",
    },
    extend: {
      colors: {
        night: {
          950: token("night-950"),
          900: token("night-900"),
          800: token("night-800"),
          700: token("night-700"),
          600: token("night-600"),
        },
        marble: {
          50: token("marble-50"),
          200: token("marble-200"),
          400: token("marble-400"),
          600: token("marble-600"),
        },
        line: token("line"),
        yes: { DEFAULT: token("yes"), soft: token("yes-soft") },
        no: { DEFAULT: token("no"), soft: token("no-soft") },
        gold: token("gold"),
      },
      fontFamily: {
        display: ["var(--font-display)", "Georgia", "serif"],
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      fontSize: {
        micro: ["0.6875rem", { lineHeight: "1rem", letterSpacing: "0.14em" }],
        "display-sm": ["clamp(2.25rem, 6vw, 3.5rem)", { lineHeight: "1.02", letterSpacing: "-0.01em" }],
        "display-md": ["clamp(2.75rem, 8vw, 5.5rem)", { lineHeight: "0.98", letterSpacing: "-0.015em" }],
        "display-lg": ["clamp(3.25rem, 11vw, 9rem)", { lineHeight: "0.92", letterSpacing: "-0.02em" }],
      },
      maxWidth: { page: "88rem" },
      transitionTimingFunction: {
        enter: "cubic-bezier(0.23, 1, 0.32, 1)",
        move: "cubic-bezier(0.65, 0, 0.35, 1)",
      },
    },
  },
  plugins: [],
};

export default config;
