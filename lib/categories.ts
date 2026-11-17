import type { Category } from "./types";

/** Gradient shown under each category render, so a missing file never looks broken. */
export const CATEGORY_TINT: Record<Category, string> = {
  crypto: "linear-gradient(140deg, rgb(var(--petal) / 0.9) 0%, rgb(var(--plum)) 100%)",
  macro: "linear-gradient(140deg, rgb(var(--blush) / 0.9) 0%, rgb(var(--cocoa)) 100%)",
  sports: "linear-gradient(140deg, rgb(var(--petal-hot) / 0.9) 0%, rgb(var(--plum)) 100%)",
  esports: "linear-gradient(140deg, rgb(var(--mauve) / 0.9) 0%, rgb(var(--ink)) 100%)",
  politics: "linear-gradient(140deg, rgb(var(--blush) / 0.9) 0%, rgb(var(--plum)) 100%)",
  world: "linear-gradient(140deg, rgb(var(--online) / 0.9) 0%, rgb(var(--cocoa)) 100%)",
  tech: "linear-gradient(140deg, rgb(var(--acc) / 0.9) 0%, rgb(var(--plum)) 100%)",
  culture: "linear-gradient(140deg, rgb(var(--petal-hot) / 0.9) 0%, rgb(var(--cocoa)) 100%)",
};

export interface CategoryMeta {
  id: Category;
  label: string;
  blurb: string;
  /** Square 3D render, 192px thumb of public/art/cat/<category>.webp (thumbs show at 80px max). */
  cover: string;
}

export const CATEGORY_META: Record<Category, CategoryMeta> = {
  crypto: {
    id: "crypto",
    label: "Crypto",
    blurb: "Prices, flows and launches across chains.",
    cover: "/art/cat/thumb/crypto.webp",
  },
  macro: {
    id: "macro",
    label: "Macro",
    blurb: "Rates, inflation, commodities and the data behind them.",
    cover: "/art/cat/thumb/macro.webp",
  },
  sports: {
    id: "sports",
    label: "Sports",
    blurb: "Matches, tables and titles, settled from official results.",
    cover: "/art/cat/thumb/sports.webp",
  },
  esports: {
    id: "esports",
    label: "Esports",
    blurb: "Majors, leagues and map counts.",
    cover: "/art/cat/thumb/esports.webp",
  },
  politics: {
    id: "politics",
    label: "Politics",
    blurb: "Votes, confirmations and policy calls.",
    cover: "/art/cat/thumb/politics.webp",
  },
  world: {
    id: "world",
    label: "World",
    blurb: "Climate records, diplomacy and events on the ground.",
    cover: "/art/cat/thumb/world.webp",
  },
  tech: {
    id: "tech",
    label: "Tech",
    blurb: "Model releases, launches and market caps.",
    cover: "/art/cat/thumb/tech.webp",
  },
  culture: {
    id: "culture",
    label: "Culture",
    blurb: "Box office, awards and releases.",
    cover: "/art/cat/thumb/culture.webp",
  },
};
