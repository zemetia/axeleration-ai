import { continuityPrompt } from '@/ai/prompts/continuity.prompt';
import { getChatModel } from '@/ai/router/model-router';
import type { ProjectModelConfig } from '@/providers/types';

/** Keeps the rolling summary bounded regardless of episode count — the IDEA prompt must stay cheap and in-token. */
export const CONTINUITY_MAX_CHARS = 1200;

/** Belt-and-suspenders truncation in case the model ignores the length instruction. */
export function truncateSummary(summary: string, maxChars = CONTINUITY_MAX_CHARS): string {
  const trimmed = summary.trim();
  if (trimmed.length <= maxChars) return trimmed;
  return trimmed.slice(0, maxChars - 1).trimEnd() + '…';
}

export interface RunContinuityChainInput {
  projectId: string;
  project?: ProjectModelConfig;
  previousSummary: string;
  episodeNumber: number;
  episodeEvents: string;
}

export async function runContinuityChain(input: RunContinuityChainInput): Promise<string> {
  const model = await getChatModel('summarize-continuity', { projectId: input.projectId, project: input.project });
  const response = await continuityPrompt.pipe(model).invoke({
    previousSummary: input.previousSummary || '(none — this is the first episode)',
    episodeNumber: input.episodeNumber,
    episodeEvents: input.episodeEvents,
    maxChars: CONTINUITY_MAX_CHARS,
  });
  const text = typeof response.content === 'string' ? response.content : JSON.stringify(response.content);
  return truncateSummary(text);
}
