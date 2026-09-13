/** @vitest-environment node */
import { describe, expect, it } from 'vitest';

import { assertPublicUrl, htmlToText } from './http-fetch';
import { parseDdgHtml } from './web-research';

describe('assertPublicUrl', () => {
  it.each([
    'http://localhost:3000/api/projects',
    'http://127.0.0.1/',
    'http://169.254.169.254/latest/meta-data/',
    'http://192.168.1.1/admin',
    'http://10.0.0.5/',
    'http://172.20.0.3/',
    'http://db.internal/',
    'file:///C:/Windows/win.ini',
  ])('rejects %s', (url) => {
    // The agent reads attacker-controlled text, so a URL it picks is not a URL a developer chose.
    expect(() => assertPublicUrl(url)).toThrow();
  });

  it.each(['https://example.com/a?b=c', 'http://news.ycombinator.com', 'https://172.15.0.1/'])('allows %s', (url) => {
    expect(assertPublicUrl(url).href).toContain(new URL(url).hostname);
  });
});

describe('htmlToText', () => {
  it('drops scripts and markup, keeps block structure, and decodes entities', () => {
    const html = '<div><script>alert(1)</script><h1>Judul &amp; Sub</h1><p>Baris satu</p><p>Baris&nbsp;dua</p></div>';
    expect(htmlToText(html)).toBe('Judul & Sub\nBaris satu\nBaris dua');
  });
});

describe('parseDdgHtml', () => {
  const html = `
    <div class="result__body">
      <a rel="nofollow" class="result__a" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fnextjs.org%2Fblog&amp;rut=abc">Next.js <b>Blog</b></a>
      <a class="result__snippet" href="#">Latest &amp; greatest releases</a>
    </div>
    <div class="result__body">
      <a rel="nofollow" class="result__a" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Freact.dev%2Fblog">React Blog</a>
      <a class="result__snippet" href="#">React team updates</a>
    </div>`;

  it('unwraps the uddg redirect and pairs each result with its snippet', () => {
    expect(parseDdgHtml(html, 5)).toEqual([
      { title: 'Next.js Blog', url: 'https://nextjs.org/blog', snippet: 'Latest & greatest releases' },
      { title: 'React Blog', url: 'https://react.dev/blog', snippet: 'React team updates' },
    ]);
  });

  it('honours maxResults', () => {
    expect(parseDdgHtml(html, 1)).toHaveLength(1);
  });

  it('returns nothing rather than garbage when the markup changes', () => {
    expect(parseDdgHtml('<div class="results"><span>no anchors here</span></div>', 5)).toEqual([]);
  });
});
