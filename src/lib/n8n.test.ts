/** @vitest-environment node */
import { createHmac } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { notifyN8n, signPayload } from './n8n';

const ORIGINAL_ENV = { url: process.env.N8N_WEBHOOK_URL, secret: process.env.N8N_WEBHOOK_SECRET };

beforeEach(() => {
  vi.restoreAllMocks();
  delete process.env.N8N_WEBHOOK_URL;
  delete process.env.N8N_WEBHOOK_SECRET;
});

afterEach(() => {
  process.env.N8N_WEBHOOK_URL = ORIGINAL_ENV.url;
  process.env.N8N_WEBHOOK_SECRET = ORIGINAL_ENV.secret;
});

describe('signPayload', () => {
  it('is an HMAC-SHA256 of the exact body', () => {
    const body = '{"episodeId":"ep-1"}';
    expect(signPayload(body, 'shh')).toBe(`sha256=${createHmac('sha256', 'shh').update(body).digest('hex')}`);
  });
});

describe('notifyN8n', () => {
  const notification = { episodeId: 'ep-1', projectId: 'proj-1', status: 'DONE' };

  it('does nothing when no webhook is configured', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    expect(await notifyN8n(notification)).toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('signs the body it actually sends', async () => {
    process.env.N8N_WEBHOOK_URL = 'https://n8n.local/hook';
    process.env.N8N_WEBHOOK_SECRET = 'shh';
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 200 }));

    expect(await notifyN8n(notification)).toBe(true);

    const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    expect(headers['x-signature-256']).toBe(signPayload(String(init.body), 'shh'));
    expect(JSON.parse(String(init.body))).toMatchObject(notification);
  });

  it('swallows a failing webhook rather than breaking the pipeline', async () => {
    process.env.N8N_WEBHOOK_URL = 'https://n8n.local/hook';
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('connection refused'));
    vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(await notifyN8n(notification)).toBe(false);
  });
});
