import { aiConfig } from '@/config/ai';

import { fetchHtml, fetchPage, type FetchedPage } from './browser-cdp';
import { decodeEntities, htmlToText, httpFetch } from './http-fetch';

/**
 * Source strategy for the research agent: *which* engine answers a search, and *how* a page gets
 * read, with a fallback ladder so one dead dependency never kills a research run.
 *
 *   search: Brave API (if a key exists) → DuckDuckGo through local Chrome → DuckDuckGo over plain HTTP
 *   read:   local Chrome (JS renders) → plain HTTP (static HTML/JSON)
 *
 * Transports live in `browser-cdp.ts` and `http-fetch.ts`; this module only decides between them.
 * Every response carries `via` so a dossier can be judged on where it actually came from.
 */

export type Recency = 'day' | 'week' | 'month' | 'year' | 'any';

export interface WebSearchResult {
  title: string;
  url: string;
  snippet: string;
}

export type SearchVia = 'brave' | 'duckduckgo-browser' | 'duckduckgo-http';

export interface WebSearchResponse {
  results: WebSearchResult[];
  via: SearchVia;
  /** Sources that were tried and failed before `via` succeeded — surfaced so a silent downgrade is visible. */
  degradedFrom?: string[];
}

export interface WebSearchOptions {
  maxResults?: number;
  recency?: Recency;
}

// ---------------------------------------------------------------------------- Brave

const BRAVE_FRESHNESS: Record<Exclude<Recency, 'any'>, string> = { day: 'pd', week: 'pw', month: 'pm', year: 'py' };

interface BraveResponse {
  web?: { results?: { title?: string; url?: string; description?: string }[] };
}

async function braveSearch(query: string, maxResults: number, recency: Recency): Promise<WebSearchResult[]> {
  const key = process.env.BRAVE_SEARCH_API_KEY;
  if (!key) throw new Error('no BRAVE_SEARCH_API_KEY');

  const url = new URL('https://api.search.brave.com/res/v1/web/search');
  url.searchParams.set('q', query);
  url.searchParams.set('count', String(Math.min(maxResults, 20)));
  if (recency !== 'any') url.searchParams.set('freshness', BRAVE_FRESHNESS[recency]);

  const response = await httpFetch(url.toString(), {
    headers: { accept: 'application/json', 'x-subscription-token': key },
    // Brave answers in JSON; the default page budget would truncate a large result set mid-object.
    maxChars: 200_000,
  });
  if (response.status !== 200) throw new Error(`brave returned ${response.status}`);

  const results = (response.json as BraveResponse | undefined)?.web?.results ?? [];
  return results
    .map((result) => ({ title: result.title ?? '', url: result.url ?? '', snippet: result.description ?? '' }))
    .filter((result) => result.title && result.url)
    .slice(0, maxResults);
}

// ---------------------------------------------------------------------------- DuckDuckGo

const DDG_DF: Record<Exclude<Recency, 'any'>, string> = { day: 'd', week: 'w', month: 'm', year: 'y' };

function ddgUrl(query: string, recency: Recency): string {
  const url = new URL('https://duckduckgo.com/html/');
  url.searchParams.set('q', query);
  if (recency !== 'any') url.searchParams.set('df', DDG_DF[recency]);
  return url.toString();
}

/** DuckDuckGo wraps every real link in a `uddg`-encoded redirect — unwrap it. */
function resolveDdgRedirect(href: string): string {
  if (!href) return '';
  try {
    const url = new URL(decodeEntities(href), 'https://duckduckgo.com');
    const real = url.searchParams.get('uddg');
    return real ? decodeURIComponent(real) : url.toString();
  } catch {
    return '';
  }
}

const DDG_LINK = /<a[^>]+class="[^"]*result__a[^"]*"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
const DDG_SNIPPET = /class="[^"]*result__snippet[^"]*"[^>]*>([\s\S]*?)<\/a>/gi;

/**
 * One parser for both DuckDuckGo transports. The `/html/` endpoint is server-rendered, so the markup
 * is identical whether Chrome fetched it or `fetch` did — the browser only buys us a real session
 * when DDG decides a bare HTTP client looks like a bot.
 */
export function parseDdgHtml(html: string, maxResults: number): WebSearchResult[] {
  const snippets = [...html.matchAll(DDG_SNIPPET)].map((match) => htmlToText(match[1] ?? ''));
  return [...html.matchAll(DDG_LINK)]
    .map((match, index) => ({
      title: htmlToText(match[2] ?? ''),
      url: resolveDdgRedirect(match[1] ?? ''),
      snippet: snippets[index] ?? '',
    }))
    .filter((result) => result.title && result.url)
    .slice(0, maxResults);
}

async function ddgViaBrowser(query: string, maxResults: number, recency: Recency): Promise<WebSearchResult[]> {
  const results = parseDdgHtml(await fetchHtml(ddgUrl(query, recency)), maxResults);
  if (results.length === 0) throw new Error('duckduckgo returned no parsable results in the browser');
  return results;
}

async function ddgViaHttp(query: string, maxResults: number, recency: Recency): Promise<WebSearchResult[]> {
  // `htmlToText` would destroy the markup this parser needs, so read the body as raw HTML.
  const response = await fetch(ddgUrl(query, recency), {
    signal: AbortSignal.timeout(20_000),
    headers: {
      'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      accept: 'text/html',
    },
  });
  if (!response.ok) throw new Error(`duckduckgo returned ${response.status}`);
  const results = parseDdgHtml(await response.text(), maxResults);
  if (results.length === 0) throw new Error('duckduckgo returned no parsable results over http');
  return results;
}

// ---------------------------------------------------------------------------- Orchestration

export async function webSearch(query: string, options: WebSearchOptions = {}): Promise<WebSearchResponse> {
  const maxResults = options.maxResults ?? aiConfig.limits.researchMaxResults;
  const recency = options.recency ?? 'any';

  const ladder: [SearchVia, () => Promise<WebSearchResult[]>][] = [
    ['brave', () => braveSearch(query, maxResults, recency)],
    ['duckduckgo-browser', () => ddgViaBrowser(query, maxResults, recency)],
    ['duckduckgo-http', () => ddgViaHttp(query, maxResults, recency)],
  ];

  const degradedFrom: string[] = [];
  for (const [via, run] of ladder) {
    try {
      const results = await run();
      return degradedFrom.length > 0 ? { results, via, degradedFrom } : { results, via };
    } catch (err) {
      degradedFrom.push(`${via}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  throw new Error(`Every web search source failed.\n${degradedFrom.join('\n')}`);
}

export interface ReadPageResponse extends FetchedPage {
  via: 'browser' | 'http';
  degradedFrom?: string;
}

/** Chrome first (JS-heavy pages resolve), plain HTTP when it isn't running or the page hangs. */
export async function readPage(url: string): Promise<ReadPageResponse> {
  try {
    return { ...(await fetchPage(url)), via: 'browser' };
  } catch (err) {
    const degradedFrom = err instanceof Error ? err.message : String(err);
    const response = await httpFetch(url);
    return { title: '', url: response.url, textContent: response.body, via: 'http', degradedFrom };
  }
}
