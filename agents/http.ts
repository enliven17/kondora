// Small fetch helpers with timeouts and a polite user agent.

// Some feeds (ESPN) reject UAs that look like crawlers with a URL in them.
const UA = "Kondora-Agents/1.0";

export async function getJson<T>(url: string, timeoutMs = 15_000, headers: Record<string, string> = {}): Promise<T> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetch(url, { headers: { "user-agent": UA, accept: "application/json", ...headers }, signal: ctrl.signal });
    if (!r.ok) throw new Error(`${r.status} ${url}`);
    return (await r.json()) as T;
  } finally {
    clearTimeout(t);
  }
}

const MAX_BYTES = 1_000_000;

/** Rejects hosts that could reach private infrastructure (SSRF). */
export function isPublicHttpsUrl(raw: string): boolean {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return false;
  }
  if (u.protocol !== "https:" || u.username || u.password || (u.port && u.port !== "443")) return false;
  const h = u.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (h === "localhost" || h.endsWith(".localhost") || h.endsWith(".local") || h.endsWith(".internal") || !h.includes(".")) return false;
  if (/^\d+\.\d+\.\d+\.\d+$/.test(h) || h.includes(":")) return false; // no IP literals at all
  return true;
}

/** Fetches text with manual redirects (each hop re-checked), a timeout and a size cap. */
export async function getText(url: string, timeoutMs = 15_000): Promise<string> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    let next = url;
    for (let hop = 0; hop < 4; hop++) {
      if (!isPublicHttpsUrl(next)) throw new Error(`blocked url ${next}`);
      const r = await fetch(next, { headers: { "user-agent": UA }, signal: ctrl.signal, redirect: "manual" });
      if (r.status >= 300 && r.status < 400) {
        const loc = r.headers.get("location");
        if (!loc) throw new Error(`redirect without location ${next}`);
        next = new URL(loc, next).toString();
        continue;
      }
      if (!r.ok) throw new Error(`${r.status} ${next}`);
      if (!r.body) return "";
      const reader = r.body.getReader();
      const chunks: Uint8Array[] = [];
      let size = 0;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.length;
        if (size > MAX_BYTES) {
          await reader.cancel();
          break;
        }
        chunks.push(value);
      }
      return new TextDecoder().decode(Buffer.concat(chunks.map((c) => Buffer.from(c))));
    }
    throw new Error(`too many redirects ${url}`);
  } finally {
    clearTimeout(t);
  }
}

/** Strips tags and collapses whitespace so pages fit in a prompt. */
export function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

export interface RssItem {
  title: string;
  link: string;
  pubDate: number;
  source: string;
}

export function parseRss(xml: string, source: string): RssItem[] {
  const items: RssItem[] = [];
  for (const m of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
    const pick = (tag: string) =>
      (m[1].match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`))?.[1] ?? "")
        .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/, "$1")
        .trim();
    const title = htmlToText(pick("title"));
    if (!title) continue;
    items.push({ title, link: pick("link"), pubDate: Math.floor(Date.parse(pick("pubDate")) / 1000) || 0, source });
  }
  return items;
}

export async function sha256Hex(data: string | Uint8Array): Promise<string> {
  const bytes = typeof data === "string" ? new TextEncoder().encode(data) : data;
  const h = await crypto.subtle.digest("SHA-256", bytes as BufferSource);
  return [...new Uint8Array(h)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Canonical JSON (sorted keys) so the same bundle always hashes the same. */
export function canonical(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(canonical).join(",")}]`;
  if (v && typeof v === "object") {
    return `{${Object.keys(v as object)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${canonical((v as Record<string, unknown>)[k])}`)
      .join(",")}}`;
  }
  return JSON.stringify(v);
}
