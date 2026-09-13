import { withPage } from './browser-cdp';
import { httpFetch } from './http-fetch';

/**
 * X (Twitter) as a research source. Two paths, same shape out:
 *
 *  1. `X_BEARER_TOKEN` set → the official v2 recent-search endpoint. Clean, rate-limited, and the
 *     search endpoints are *not* on X's free tier — so this is opt-in, never assumed.
 *  2. Otherwise → x.com's own search page in the user's **signed-in** local Chrome profile, because
 *     logged-out X shows a login wall instead of results. That means these requests are made as the
 *     user's own account: it is their session, their rate limit, and their exposure if X objects to
 *     automated reading. It is the only keyless way in, and it stays behind an explicit tool call.
 *
 * Why X at all: for "what happened this week" questions, announcements and practitioner reaction land
 * here hours-to-days before anything indexable gets written about them. Posts are *claims*, though —
 * the research prompt requires corroborating one on the open web before it becomes a cited finding.
 */

export interface XPost {
  url: string;
  author: string;
  handle: string;
  text: string;
  postedAt?: string;
  metrics?: { likes: number; reposts: number; replies: number };
}

export interface XSearchResponse {
  posts: XPost[];
  via: 'api' | 'browser';
  query: string;
}

export interface XSearchOptions {
  maxResults?: number;
  /** `latest` is reverse-chronological (what's happening now); `top` is X's engagement ranking. */
  mode?: 'latest' | 'top';
}

// ---------------------------------------------------------------------------- Official API

interface XApiResponse {
  data?: {
    id: string;
    text: string;
    author_id?: string;
    created_at?: string;
    public_metrics?: { like_count: number; retweet_count: number; reply_count: number };
  }[];
  includes?: { users?: { id: string; name: string; username: string }[] };
}

async function searchViaApi(query: string, maxResults: number): Promise<XPost[]> {
  const token = process.env.X_BEARER_TOKEN;
  if (!token) throw new Error('no X_BEARER_TOKEN');

  const url = new URL('https://api.x.com/2/tweets/search/recent');
  url.searchParams.set('query', query);
  // The endpoint rejects anything outside 10..100 regardless of what the caller wanted.
  url.searchParams.set('max_results', String(Math.min(Math.max(maxResults, 10), 100)));
  url.searchParams.set('tweet.fields', 'created_at,public_metrics');
  url.searchParams.set('expansions', 'author_id');
  url.searchParams.set('user.fields', 'username,name');

  const response = await httpFetch(url.toString(), {
    headers: { accept: 'application/json', authorization: `Bearer ${token}` },
    maxChars: 200_000,
  });
  if (response.status !== 200) throw new Error(`x api returned ${response.status}`);

  const payload = response.json as XApiResponse | undefined;
  const users = new Map((payload?.includes?.users ?? []).map((user) => [user.id, user]));

  return (payload?.data ?? []).slice(0, maxResults).map((post) => {
    const user = post.author_id ? users.get(post.author_id) : undefined;
    return {
      url: `https://x.com/${user?.username ?? 'i'}/status/${post.id}`,
      author: user?.name ?? '',
      handle: user?.username ? `@${user.username}` : '',
      text: post.text,
      postedAt: post.created_at,
      metrics: post.public_metrics && {
        likes: post.public_metrics.like_count,
        reposts: post.public_metrics.retweet_count,
        replies: post.public_metrics.reply_count,
      },
    };
  });
}

// ---------------------------------------------------------------------------- Signed-in browser

interface RawTweet {
  text: string;
  nameBlock: string;
  href: string;
  time: string | null;
}

async function searchViaBrowser(query: string, maxResults: number, mode: 'latest' | 'top'): Promise<XPost[]> {
  const url = new URL('https://x.com/search');
  url.searchParams.set('q', query);
  if (mode === 'latest') url.searchParams.set('f', 'live');

  return withPage(async (page) => {
    await page.goto(url.toString(), { waitUntil: 'domcontentloaded', timeout: 30_000 });

    try {
      await page.waitForSelector('article[data-testid="tweet"]', { timeout: 20_000 });
    } catch {
      throw new Error(
        page.url().includes('/i/flow/login') || page.url().includes('/login')
          ? 'X redirected to its login wall — sign in to x.com inside the Chrome instance at RESEARCH_CDP_ENDPOINT, or set X_BEARER_TOKEN.'
          : 'X returned no posts (rate limited, or the search rendered empty).',
      );
    }

    const seen = new Map<string, XPost>();
    // X virtualises its timeline: posts scrolled past are removed from the DOM, so collect on each pass.
    for (let pass = 0; pass < 6 && seen.size < maxResults; pass += 1) {
      const raw: RawTweet[] = await page.$$eval('article[data-testid="tweet"]', (articles) =>
        articles.map((article) => ({
          text: (article.querySelector('div[data-testid="tweetText"]') as HTMLElement | null)?.innerText ?? '',
          nameBlock: (article.querySelector('div[data-testid="User-Name"]') as HTMLElement | null)?.innerText ?? '',
          href: article.querySelector('a[href*="/status/"]')?.getAttribute('href') ?? '',
          time: article.querySelector('time')?.getAttribute('datetime') ?? null,
        })),
      );

      for (const tweet of raw) {
        if (!tweet.href || !tweet.text) continue;
        const postUrl = new URL(tweet.href, 'https://x.com').toString();
        if (seen.has(postUrl)) continue;
        // "Display Name\n@handle\n·\n2h" — the handle is the only line that is reliably identifiable.
        const lines = tweet.nameBlock.split('\n').map((line) => line.trim());
        seen.set(postUrl, {
          url: postUrl,
          author: lines[0] ?? '',
          handle: lines.find((line) => line.startsWith('@')) ?? '',
          text: tweet.text,
          postedAt: tweet.time ?? undefined,
        });
        if (seen.size >= maxResults) break;
      }

      await page.mouse.wheel(0, 2400);
      await page.waitForTimeout(1200);
    }

    return [...seen.values()].slice(0, maxResults);
  }, 'signed-in');
}

export async function xSearch(query: string, options: XSearchOptions = {}): Promise<XSearchResponse> {
  const maxResults = options.maxResults ?? 10;
  const mode = options.mode ?? 'latest';

  if (process.env.X_BEARER_TOKEN) {
    try {
      return { posts: await searchViaApi(query, maxResults), via: 'api', query };
    } catch (err) {
      console.warn('[x-search] API path failed, falling back to the signed-in browser:', err);
    }
  }

  return { posts: await searchViaBrowser(query, maxResults, mode), via: 'browser', query };
}
