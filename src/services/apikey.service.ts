import { decryptSecret, encryptSecret } from '@/lib/crypto';
import { prisma } from '@/lib/prisma';
import type { ApiKeyVO } from '@/types/value-objects';
import type { ApiKey } from '@prisma/client';

function toApiKeyVO(row: ApiKey): ApiKeyVO {
  return {
    id: row.id,
    provider: row.provider,
    label: row.label,
    lastFour: row.lastFour,
    isActive: row.isActive,
    updatedAt: row.updatedAt.toISOString(),
  };
}

export const apiKeyService = {
  /** All of a user's saved keys, across every provider — the global settings page. */
  async listForUser(userId: string): Promise<ApiKeyVO[]> {
    const rows = await prisma.apiKey.findMany({
      where: { userId },
      orderBy: [{ provider: 'asc' }, { createdAt: 'asc' }],
    });
    return rows.map(toApiKeyVO);
  },

  /**
   * Which providers this user can actually call right now — the credential half of the preflight
   * check in `src/lib/provider-readiness.ts`.
   *
   * `platform` is kept separate from `saved` on purpose. The environment fallback only exists
   * inside `resolveApiKey` in `src/ai/router/model-router.ts`, so it covers the LLM path and
   * nothing else; the video, TTS and music nodes go straight to `getDecrypted` and receive `''`
   * when there is no row. Merging the two lists would report a SCENES run as ready when it has no
   * video credential at all.
   */
  async credentialedProviders(userId: string): Promise<{ saved: string[]; platform: string[] }> {
    const rows = await prisma.apiKey.findMany({
      where: { userId, isActive: true },
      select: { provider: true },
      distinct: ['provider'],
    });

    const platform: string[] = [];
    if (process.env.PLATFORM_ANTHROPIC_API_KEY) platform.push('anthropic');
    if (process.env.SUMOPOD_API_KEY) platform.push('sumopod');
    if (process.env.DEEPSEEK_API_KEY) platform.push('deepseek');

    return { saved: rows.map((row) => row.provider), platform };
  },

  /** Encrypts the plaintext key at rest; only the last four characters are ever stored/read back in the clear. */
  async create(userId: string, provider: string, plaintext: string, label?: string): Promise<ApiKeyVO> {
    const ciphertext = encryptSecret(plaintext);
    const lastFour = plaintext.slice(-4);
    const row = await prisma.apiKey.create({
      data: { userId, provider, ciphertext, lastFour, label },
    });
    return toApiKeyVO(row);
  },

  /** Ownership-checked rename/rotate/toggle. Returns `null` if the key doesn't belong to `userId`. */
  async update(
    id: string,
    userId: string,
    input: { label?: string; plaintext?: string; isActive?: boolean },
  ): Promise<ApiKeyVO | null> {
    const existing = await prisma.apiKey.findUnique({ where: { id } });
    if (!existing || existing.userId !== userId) return null;

    const row = await prisma.apiKey.update({
      where: { id },
      data: {
        label: input.label,
        isActive: input.isActive,
        ...(input.plaintext
          ? { ciphertext: encryptSecret(input.plaintext), lastFour: input.plaintext.slice(-4) }
          : {}),
      },
    });
    return toApiKeyVO(row);
  },

  /**
   * Ownership-checked decrypt for the "test this saved key" path. Scoped by `userId` rather than
   * by project like `getDecrypted`, because re-testing a key is something the key's owner does from
   * global settings, with no project in hand. Never return this to the client.
   */
  async getDecryptedForUser(
    id: string,
    userId: string,
  ): Promise<{ provider: string; plaintext: string } | null> {
    const row = await prisma.apiKey.findUnique({ where: { id } });
    if (!row || row.userId !== userId) return null;
    return { provider: row.provider, plaintext: decryptSecret(row.ciphertext) };
  },

  /** Ownership-checked delete. Returns `false` if the key doesn't belong to `userId`. */
  async remove(id: string, userId: string): Promise<boolean> {
    const existing = await prisma.apiKey.findUnique({ where: { id } });
    if (!existing || existing.userId !== userId) return false;
    await prisma.apiKey.delete({ where: { id } });
    return true;
  },

  /**
   * Server-only: decrypts a key for the AI pipeline, resolved via the owning project (so call
   * sites keep passing `projectId`, not `userId`). Precedence: the specific `apiKeyId` (verified
   * to belong to the project's owner and match `provider`) → the owner's oldest active key for
   * that provider. Never expose the return value to the client.
   */
  async getDecrypted(projectId: string, provider: string, apiKeyId?: string): Promise<string | null> {
    const project = await prisma.project.findUnique({ where: { id: projectId }, select: { ownerId: true } });
    if (!project) return null;

    if (apiKeyId) {
      const row = await prisma.apiKey.findUnique({ where: { id: apiKeyId } });
      if (row && row.userId === project.ownerId && row.provider === provider && row.isActive) {
        return decryptSecret(row.ciphertext);
      }
      // Falls through to the provider default below if the stored id is stale (deleted/reassigned).
    }

    const row = await prisma.apiKey.findFirst({
      where: { userId: project.ownerId, provider, isActive: true },
      orderBy: { createdAt: 'asc' },
    });
    if (!row) return null;
    return decryptSecret(row.ciphertext);
  },
};
