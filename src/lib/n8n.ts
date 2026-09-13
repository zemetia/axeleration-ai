import { createHmac } from 'node:crypto';

/**
 * Fire-and-forget notification to an n8n webhook when an episode reaches a terminal state.
 *
 * Config is environment-level (`N8N_WEBHOOK_URL` / `N8N_WEBHOOK_SECRET`) rather than per-project:
 * the Project model has no webhook columns yet and this app runs local-first for one developer.
 * Moving to per-project means two Prisma fields + the T09 `N8nWebhookForm`; this module is the
 * only place that would change.
 */

export interface EpisodeNotification {
  episodeId: string;
  projectId: string;
  status: string;
}

/** HMAC-SHA256 over the exact bytes sent, so n8n can verify the payload wasn't forged. */
export function signPayload(body: string, secret: string): string {
  return `sha256=${createHmac('sha256', secret).update(body).digest('hex')}`;
}

/** Returns false when no webhook is configured or the POST fails — never throws into the pipeline. */
export async function notifyN8n(notification: EpisodeNotification): Promise<boolean> {
  const url = process.env.N8N_WEBHOOK_URL;
  if (!url) return false;

  const body = JSON.stringify({ ...notification, sentAt: new Date().toISOString() });
  const headers: Record<string, string> = { 'content-type': 'application/json' };

  const secret = process.env.N8N_WEBHOOK_SECRET;
  if (secret) headers['x-signature-256'] = signPayload(body, secret);

  try {
    const response = await fetch(url, { method: 'POST', headers, body });
    if (!response.ok) console.error(`[n8n] webhook returned ${response.status} for episode ${notification.episodeId}`);
    return response.ok;
  } catch (err) {
    console.error(`[n8n] webhook failed for episode ${notification.episodeId}:`, err);
    return false;
  }
}
