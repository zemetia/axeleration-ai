import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import type { ContentBlock } from '@langchain/core/messages';

import { BIBLE_SYSTEM_PROMPT, bibleUserPrompt, lockedTraitsSchema, type LockedTraits } from '@/ai/prompts/bible.prompt';
import { getChatModel } from '@/ai/router/model-router';
import { keyFromUrl, readObject } from '@/lib/storage';
import type { ProjectModelConfig } from '@/providers/types';

const MIME_BY_EXTENSION: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  gif: 'image/gif',
};

/** Inlines a locally stored seed image as a base64 content block. Returns null for anything we can't read. */
async function seedImageBlock(seedImageUrl: string): Promise<ContentBlock.Standard | null> {
  try {
    const key = keyFromUrl(seedImageUrl);
    const extension = key.split('.').pop()?.toLowerCase() ?? '';
    const mime = MIME_BY_EXTENSION[extension];
    if (!mime) return null;

    const bytes = await readObject(key);
    return { type: 'image', mimeType: mime, data: bytes.toString('base64') };
  } catch (err) {
    console.error('[bible] could not read seed image, falling back to text-only:', err);
    return null;
  }
}

export interface RunBibleChainInput {
  projectId: string;
  projectType: string;
  premise: string;
  /** Tags, audience, tone, visual style and language — see `buildProjectBrief`. */
  brief: string;
  seedImageUrl?: string | null;
  modelConfig?: ProjectModelConfig;
}

/** Identity-lock chain: seed image (when present) + premise → structured, reusable locked traits. */
export async function runBibleChain(input: RunBibleChainInput): Promise<LockedTraits> {
  const image = input.seedImageUrl ? await seedImageBlock(input.seedImageUrl) : null;
  const model = await getChatModel('character-bible', { projectId: input.projectId, project: input.modelConfig });

  const content: ContentBlock.Standard[] = [
    {
      type: 'text',
      text: bibleUserPrompt({
        projectType: input.projectType,
        premise: input.premise,
        brief: input.brief,
        hasSeedImage: Boolean(image),
      }),
    },
  ];
  if (image) content.push(image);

  // `method: 'jsonMode'` — see `script.node.ts` for why bare `.withStructuredOutput()` 400s on
  // DeepSeek and most Sumopod-routed models ("response_format type is unavailable").
  const structured = model.withStructuredOutput(lockedTraitsSchema, { method: 'jsonMode' });
  return structured.invoke([new SystemMessage(BIBLE_SYSTEM_PROMPT), new HumanMessage({ content })]);
}
