import { refinePremisePrompt } from '@/ai/prompts/refine-premise.prompt';
import { getChatModel } from '@/ai/router/model-router';

export interface RunRefinePremiseInput {
  premise: string;
  projectType: string;
  /** Absent in the new-project wizard — no `ApiKey` row exists yet, so there's nothing to select a provider from. */
  projectId?: string;
}

/**
 * Pre-project-creation assist. When there's no `projectId` yet (new-project wizard), the usual
 * project-scoped provider selection has nothing to select from, so this routes straight through
 * the Sumopod platform key instead of `aiConfig.defaults.llmText`.
 */
export async function runRefinePremiseChain(input: RunRefinePremiseInput): Promise<string> {
  const model = await getChatModel('refine-premise', {
    projectId: input.projectId,
    override: input.projectId ? undefined : { provider: 'sumopod', model: 'claude-haiku-4-5' },
  });

  const messages = await refinePremisePrompt.formatMessages({
    premise: input.premise,
    projectType: input.projectType,
  });
  const response = await model.invoke(messages);
  return typeof response.content === 'string' ? response.content : String(response.content);
}
