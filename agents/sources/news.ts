// Headlines that the creator agent turns into short-dated questions. These
// settle through the council, so the prompt forces explicit, checkable criteria.

import { getText, parseRss, RssItem } from "../http";
import { nowSec } from "../types";

const FEEDS: [string, string][] = [
  ["BBC World", "https://feeds.bbci.co.uk/news/world/rss.xml"],
  ["BBC Business", "https://feeds.bbci.co.uk/news/business/rss.xml"],
  ["BBC Technology", "https://feeds.bbci.co.uk/news/technology/rss.xml"],
  ["BBC Entertainment", "https://feeds.bbci.co.uk/news/entertainment_and_arts/rss.xml"],
  ["NPR Politics", "https://feeds.npr.org/1014/rss.xml"],
  ["Hacker News", "https://hnrss.org/frontpage?points=200"],
  ["The Verge", "https://www.theverge.com/rss/index.xml"],
];

export async function headlines(maxAgeHours = 36, perFeed = 12): Promise<RssItem[]> {
  const cutoff = nowSec() - maxAgeHours * 3600;
  const lists = await Promise.all(
    FEEDS.map(async ([name, url]) => {
      try {
        return parseRss(await getText(url), name)
          .filter((i) => !i.pubDate || i.pubDate >= cutoff)
          .slice(0, perFeed);
      } catch {
        return [];
      }
    }),
  );
  return lists.flat();
}

/** Google News search, used by the council to gather fresh evidence. */
export async function searchNews(query: string, max = 8): Promise<RssItem[]> {
  try {
    const xml = await getText(`https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-US&gl=US&ceid=US:en`);
    return parseRss(xml, "Google News").slice(0, max);
  } catch {
    return [];
  }
}
