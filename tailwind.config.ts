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
      xs: "4px",
      sm: "6px",
      DEFAULT: "10px",
      md: "10px",
      lg: "14px",
      xl: "20px",
      "2xl": "28px",
    },
    extend: {
      colors: {
        /* Light marketing surfaces */
        paper: token("paper"),
        blush: token("blush"),
        petal: { DEFAULT: token("petal"), hot: token("petal-hot") },
        /* Dark app surfaces, deepest last */
        plum: token("plum"),
        cocoa: token("cocoa"),
        panel: { DEFAULT: token("panel"), deep: token("panel-deep") },
        ink: token("ink"),
        bg: token("bg"),
        /* Text */
        fg: token("fg"),
        haze: token("haze"),
        mauve: { DEFAULT: token("mauve"), soft: token("mauve-soft") },
        muted: token("muted"),
        /* Signals */
        acc: { DEFAULT: token("acc"), hover: token("acc-hover"), ink: token("acc-ink") },
        up: token("up"),
        down: token("down"),
        gold: token("gold"),
        online: token("online"),
        line: token("line"),

        /* Legacy aliases kept only while screens are rebuilt. Do not use in new code. */
        night: { 950: token("bg"), 900: token("panel"), 800: token("cocoa"), 700: token("plum"), 600: token("mauve-soft") },
        marble: { 50: token("fg"), 200: token("blush"), 400: token("muted"), 600: token("mauve") },
        yes: { DEFAULT: token("up"), soft: token("up-soft") },
        no: { DEFAULT: token("down"), soft: token("down-soft") },
      },
      fontFamily: {
        display: ["var(--font-sans)", "system-ui", "sans-serif"],
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      fontSize: {
        micro: ["0.6875rem", { lineHeight: "1rem", letterSpacing: "0.08em" }],
        "display-sm": ["clamp(2rem, 5vw, 3rem)", { lineHeight: "1.05", letterSpacing: "-0.03em" }],
        "display-md": ["clamp(2.5rem, 7vw, 4.5rem)", { lineHeight: "1", letterSpacing: "-0.04em" }],
        "display-lg": ["clamp(3rem, 9vw, 6.5rem)", { lineHeight: "0.95", letterSpacing: "-0.045em" }],
      },
      maxWidth: { page: "90rem" },
      transitionTimingFunction: {
        enter: "cubic-bezier(0.23, 1, 0.32, 1)",
        move: "cubic-bezier(0.65, 0, 0.35, 1)",
      },
    },
  },
  plugins: [],
};

export default config;
