// Domains the council may read for evidence. LLM-proposed sources outside this
// list are dropped, so settlement cannot hinge on a page anyone can edit.

import { isPublicHttpsUrl } from "../http";

const TRUSTED = [
  "reuters.com", "apnews.com", "bbc.com", "bbc.co.uk", "npr.org", "theguardian.com", "nytimes.com", "wsj.com",
  "ft.com", "bloomberg.com", "cnbc.com", "aljazeera.com", "politico.com", "axios.com", "economist.com",
  "theverge.com", "techcrunch.com", "arstechnica.com", "wired.com", "engadget.com",
  "espn.com", "uefa.com", "fifa.com", "nba.com", "nfl.com", "formula1.com", "atptour.com",
  "federalreserve.gov", "bls.gov", "bea.gov", "sec.gov", "whitehouse.gov", "congress.gov", "senate.gov", "house.gov",
  "europa.eu", "ecb.europa.eu", "un.org", "who.int", "imf.org", "worldbank.org", "nasa.gov",
  "polymarket.com", "coingecko.com", "binance.com", "coinbase.com",
  "openai.com", "anthropic.com", "blog.google", "apple.com", "microsoft.com", "nvidia.com", "spacex.com", "tesla.com",
  "boxofficemojo.com", "billboard.com", "imdb.com", "oscars.org", "grammy.com",
];

export const TRUSTED_HINT = TRUSTED.slice(0, 24).join(", ") + " and official government or company sites in the list";

export function isTrustedSource(url: string): boolean {
  if (!isPublicHttpsUrl(url)) return false;
  const host = new URL(url).hostname.toLowerCase();
  return TRUSTED.some((d) => host === d || host.endsWith(`.${d}`));
}
