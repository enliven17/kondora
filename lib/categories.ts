import type { Category } from "./types";

export interface CategoryMeta {
  id: Category;
  label: string;
  blurb: string;
  cover: string;
}

export const CATEGORY_META: Record<Category, CategoryMeta> = {
  crypto: {
    id: "crypto",
    label: "Crypto",
    blurb: "Prices, flows and launches across chains.",
    cover: "/art/cat-crypto.webp",
  },
  macro: {
    id: "macro",
    label: "Macro",
    blurb: "Rates, inflation, commodities and the data behind them.",
    cover: "/art/cat-macro.webp",
  },
  sports: {
    id: "sports",
    label: "Sports",
    blurb: "Matches, tables and titles, settled from official results.",
    cover: "/art/cat-sports.webp",
  },
  esports: {
    id: "esports",
    label: "Esports",
    blurb: "Majors, leagues and map counts.",
    cover: "/art/cat-esports.webp",
  },
  politics: {
    id: "politics",
    label: "Politics",
    blurb: "Votes, confirmations and policy calls.",
    cover: "/art/cat-politics.webp",
  },
  world: {
    id: "world",
    label: "World",
    blurb: "Climate records, diplomacy and events on the ground.",
    cover: "/art/cat-world.webp",
  },
  tech: {
    id: "tech",
    label: "Tech",
    blurb: "Model releases, launches and market caps.",
    cover: "/art/cat-tech.webp",
  },
  culture: {
    id: "culture",
    label: "Culture",
    blurb: "Box office, awards and releases.",
    cover: "/art/cat-culture.webp",
  },
};
