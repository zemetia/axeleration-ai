import { aiConfig } from '@/config/ai';

/**
 * The keyless, browserless half of the research agent's reach — a plain `fetch` with HTML stripped
 * to text. It is the `curl` in the toolbox: no Chrome needed, ~20x faster than a CDP render, and the
 * only sane way to read the JSON/RSS endpoints (HN Algolia, GitHub, arXiv, Reddit) that answer a
 * "what's new" question far better than a search results page does. `browser-cdp.ts` stays the path
 * for pages that only exist after JS runs.
 */

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

export function decodeEntities(input: string): string {
  return input.replace(/&(#x[0-9a-f]+|#[0-9]+|[a-z]+);/gi, (match, code: string) => {
    const lower = code.toLowerCase();
    if (lower.startsWith('#x')) {
      const point = Number.parseInt(lower.slice(2), 16);
      return Number.isNaN(point) ? match : String.fromCodePoint(point);
    }
    if (lower.startsWith('#')) {
      const point = Number.parseInt(lower.slice(1), 10);
      return Number.isNaN(point) ? match : String.fromCodePoint(point);
    }
    return ENTITIES[lower] ?? match;
  });
}

/** Good enough for reading prose off a page — not a parser, and deliberately not a dependency. */
export function htmlToText(html: string): string {
  return decodeEntities(
    html
      .replace(/<(script|style|noscript|svg)[\s\S]*?<\/\1>/gi, ' ')
      .replace(/<!--[\s\S]*?-->/g, ' ')
      .replace(/<\/(p|div|li|tr|h[1-6]|section|article)>/gi, '\n')
      .replace(/<(br|hr)\s*\/?>/gi, '\n')
      .replace(/<[^>]+>/g, ' '),
  )
    .replace(/[ \t ]+/g, ' ')
    .replace(/ ?\n ?/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

const PRIVATE_HOSTS = /^(localhost|.*\.local|.*\.internal|.*\.localhost)$/i;
const PRIVATE_IPV4 =
  /^(10\.|127\.|0\.|169\.254\.|192\.168\.|172\.(1[6-9]|2[0-9]|3[01])\.|100\.(6[4-9]|[7-9][0-9]|1[01][0-9]|12[0-7])\.)/;

/**
 * SSRF guard. The agent reads attacker-controlled text (search snippets, X posts, page bodies), so a
 * URL it decides to fetch is not a URL the developer chose — without this, one injected instruction
 * turns a research tool into a reader of this machine's own localhost app and cloud metadata.
 * Literal-host check only: a public domain that resolves to a private IP still gets through, which is
 * the accepted limit here (blocking that needs DNS resolution + a pinned-IP fetch).
 */
export function assertPublicUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error(`Not a valid URL: ${raw}`);
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error(`Refusing to fetch ${url.protocol}// — only http and https are allowed.`);
  }
  const host = url.hostname.replace(/^\[|\]$/g, '');
  if (PRIVATE_HOSTS.test(host) || PRIVATE_IPV4.test(host) || host === '::1' || /^f[cd][0-9a-f]{2}:/i.test(host)) {
    throw new Error(`Refusing to fetch a private/loopback address (${host}) — research tools reach the public web only.`);
  }
  return url;
}

export interface HttpFetchResult {
  url: string;
  status: number;
  contentType: string;
  /** Parsed JSON when the response is JSON, otherwise omitted — saves the model re-parsing `body`. */
  json?: unknown;
  /** Text content: JSON pretty-printed, HTML stripped to prose, everything else verbatim. */
  body: string;
  truncated: boolean;
}

export interface HttpFetchOptions {
  maxChars?: number;
  timeoutMs?: number;
  /** Extra request headers — used by API sources (e.g. a bearer token), never by the model. */
  headers?: Record<string, string>;
}

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

export async function httpFetch(rawUrl: string, options: HttpFetchOptions = {}): Promise<HttpFetchResult> {
  const url = assertPublicUrl(rawUrl);
  const maxChars = options.maxChars ?? aiConfig.limits.researchPageChars;

  const response = await fetch(url, {
    redirect: 'follow',
    signal: AbortSignal.timeout(options.timeoutMs ?? 20_000),
    headers: {
      'user-agent': USER_AGENT,
      accept: 'application/json, text/html;q=0.9, text/plain;q=0.8, */*;q=0.5',
      'accept-language': 'en-US,en;q=0.9,id;q=0.8',
      ...options.headers,
    },
  });

  const contentType = response.headers.get('content-type') ?? '';
  const raw = await response.text();

  if (contentType.includes('json')) {
    try {
      const json: unknown = JSON.parse(raw);
      const pretty = JSON.stringify(json, null, 2);
      return {
        url: response.url || url.toString(),
        status: response.status,
        contentType,
        json,
        body: pretty.slice(0, maxChars),
        truncated: pretty.length > maxChars,
      };
    } catch {
      // Mislabelled as JSON — fall through and treat it as text.
    }
  }

  const text = contentType.includes('html') ? htmlToText(raw) : raw.trim();
  return {
    url: response.url || url.toString(),
    status: response.status,
    contentType,
    body: text.slice(0, maxChars),
    truncated: text.length > maxChars,
  };
}
