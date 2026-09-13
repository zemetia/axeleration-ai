import { chromium, type Browser, type BrowserContext, type Page } from 'playwright-core';

import { aiConfig } from '@/config/ai';

import { assertPublicUrl } from './http-fetch';

/**
 * Browser transport for the research tools: a real, already-running local Chrome driven over the
 * Chrome DevTools Protocol instead of a paid search API — this app is local-first, so there's no
 * server to host a headless browser and no reason to pay a vendor just to fetch a results page. The
 * user launches Chrome themselves with a debug port open (see `.env.example`); we only connect.
 *
 * This module stays transport-only. Which *source* to ask (Brave / DuckDuckGo / plain HTTP) is
 * `web-research.ts`'s decision; X's DOM shape is `x-search.ts`'s problem.
 */

const CDP_ENDPOINT = process.env.RESEARCH_CDP_ENDPOINT ?? 'http://localhost:9222';

let browserPromise: Promise<Browser> | null = null;

async function connect(): Promise<Browser> {
  try {
    return await chromium.connectOverCDP(CDP_ENDPOINT);
  } catch (err) {
    throw new Error(
      `Could not reach local Chrome at ${CDP_ENDPOINT} for research tools. ` +
        `Launch it with --remote-debugging-port and set RESEARCH_CDP_ENDPOINT if not the default. Cause: ${
          err instanceof Error ? err.message : String(err)
        }`,
    );
  }
}

/** Reconnects lazily if the cached connection died (e.g. the user closed Chrome). */
async function getBrowser(): Promise<Browser> {
  if (!browserPromise) browserPromise = connect();
  try {
    const browser = await browserPromise;
    if (!browser.isConnected()) throw new Error('stale');
    return browser;
  } catch {
    browserPromise = connect();
    return browserPromise;
  }
}

/**
 * `isolated` (default) — a throwaway context, so cookies/history from one research run never leak
 * into the next. `signed-in` — Chrome's *existing* context, i.e. the user's real logged-in profile.
 * Only sources that are unreadable while logged out (X) may ask for it, and it carries a real cost:
 * those requests are made as the user's own account, under their rate limits.
 */
export type BrowserProfile = 'isolated' | 'signed-in';

export async function withPage<T>(fn: (page: Page) => Promise<T>, profile: BrowserProfile = 'isolated'): Promise<T> {
  const browser = await getBrowser();

  if (profile === 'signed-in') {
    const [context] = browser.contexts() as BrowserContext[];
    if (!context) throw new Error('The local Chrome has no open profile context to reuse — open a window in it first.');
    const page = await context.newPage();
    try {
      return await fn(page);
    } finally {
      await page.close();
    }
  }

  const context = await browser.newContext();
  try {
    return await fn(await context.newPage());
  } finally {
    await context.close();
  }
}

export interface FetchedPage {
  title: string;
  url: string;
  textContent: string;
}

/** Renders `url` in the real browser (so JS-heavy pages still resolve) and returns its visible text. */
export async function fetchPage(url: string, profile: BrowserProfile = 'isolated'): Promise<FetchedPage> {
  assertPublicUrl(url);
  return withPage(async (page) => {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20_000 });
    const title = await page.title();
    const text = await page
      .locator('body')
      .innerText()
      .catch(() => '');
    const textContent = text
      .replace(/[ \t]+\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim()
      .slice(0, aiConfig.limits.researchPageChars);
    return { title, url, textContent };
  }, profile);
}

/** Raw HTML after the page settles — for sources parsed the same way over both transports (see `web-research.ts`). */
export async function fetchHtml(url: string, profile: BrowserProfile = 'isolated'): Promise<string> {
  assertPublicUrl(url);
  return withPage(async (page) => {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20_000 });
    return page.content();
  }, profile);
}
