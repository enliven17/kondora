import fs from "node:fs";
import path from "node:path";

import GithubSlugger from "github-slugger";
import matter from "gray-matter";

export interface DocMeta {
  slug: string;
  title: string;
  description: string;
  order: number;
  section: string;
}

export interface Doc extends DocMeta {
  body: string;
  headings: { depth: 2 | 3; text: string; id: string }[];
}

const DIR = path.join(process.cwd(), "content", "docs");
export const DEFAULT_DOC = "introduction";

function stripInline(md: string) {
  return md
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/[*_]/g, "")
    .trim();
}

/** h2 and h3 outside code fences, slugged in document order (matches the renderer). */
function extractHeadings(body: string): Doc["headings"] {
  const slugger = new GithubSlugger();
  const out: Doc["headings"] = [];
  let fenced = false;
  for (const line of body.split("\n")) {
    if (/^\s*```/.test(line)) fenced = !fenced;
    if (fenced) continue;
    const m = /^(##|###)\s+(.+?)\s*#*$/.exec(line);
    if (!m) continue;
    const text = stripInline(m[2] as string);
    out.push({ depth: m[1] === "##" ? 2 : 3, text, id: slugger.slug(text) });
  }
  return out;
}

let cache: Doc[] | null = null;

export function getAllDocs(): Doc[] {
  if (cache && process.env.NODE_ENV === "production") return cache;
  const docs = fs
    .readdirSync(DIR)
    .filter((f) => f.endsWith(".md"))
    .map((file) => {
      const { data, content } = matter(fs.readFileSync(path.join(DIR, file), "utf8"));
      const slug = file.replace(/\.md$/, "");
      // The page renders the title from frontmatter, so drop a leading H1.
      const body = content.replace(/^\s*#\s+.+\n/, "").trim();
      return {
        slug,
        title: String(data.title ?? slug),
        description: String(data.description ?? ""),
        order: Number(data.order ?? 99),
        section: String(data.section ?? "Docs"),
        body,
        headings: extractHeadings(body),
      };
    })
    .sort((a, b) => a.order - b.order);
  cache = docs;
  return docs;
}

export function getDoc(slug: string): Doc | null {
  return getAllDocs().find((d) => d.slug === slug) ?? null;
}

export function docHref(slug: string) {
  return slug === DEFAULT_DOC ? "/docs" : `/docs/${slug}`;
}

/** Sections in reading order, each with its docs. */
export function getDocNav(): { section: string; docs: DocMeta[] }[] {
  const groups = new Map<string, DocMeta[]>();
  for (const { body: _body, headings: _headings, ...meta } of getAllDocs()) {
    void _body;
    void _headings;
    groups.set(meta.section, [...(groups.get(meta.section) ?? []), meta]);
  }
  return [...groups].map(([section, docs]) => ({ section, docs }));
}
