import { ChatAnthropic } from '@langchain/anthropic';
import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { ChatOpenAI } from '@langchain/openai';

import { apiKeyService } from '@/services';
import { createDeepseekChatModel } from '@/providers/adapters/deepseek.adapter';
import { createSumopodChatModel } from '@/providers/adapters/sumopod.adapter';
import { providerRegistry } from '@/providers/registry';
import type { ProjectModelConfig } from '@/providers/types';

export type LlmTask =
  | 'idea'
  | 'idea-research'
  | 'script'
  | 'scene-compose'
  | 'voice'
  | 'music'
  | 'summarize-continuity'
  | 'character-bible'
  | 'research'
  | 'refine-premise';

/** Creative stages run hotter; structural stages (JSON output, continuity summary) run cold. */
const TASK_TEMPERATURE: Record<LlmTask, number> = {
  idea: 0.9,
  // Brainstorming raw angles, not committing to a final idea — slightly cooler than `idea` itself.
  'idea-research': 0.8,
  script: 0.4,
  'scene-compose': 0.6,
  voice: 0.4,
  music: 0.7,
  'summarize-continuity': 0.2,
  // The bible is a lock, not a draft — the same premise should keep producing the same identity.
  'character-bible': 0.1,
  // Fact-finding, not creative writing — favor accuracy over variety in both the tool loop and the compile pass.
  research: 0.2,
  // Polish, not reinvention — keep the author's idea recognizable.
  'refine-premise': 0.5,
};

export interface GetChatModelOptions {
  /** Owning project — resolves its `modelConfig` override and its stored API key. */
  projectId?: string;
  project?: ProjectModelConfig;
  override?: { provider: string; model: string };
}

async function resolveApiKey(projectId: string | undefined, provider: string, apiKeyId?: string): Promise<string> {
  const projectKey = projectId ? await apiKeyService.getDecrypted(projectId, provider, apiKeyId) : null;
  if (projectKey) return projectKey;
  if (provider === 'anthropic' && process.env.PLATFORM_ANTHROPIC_API_KEY) {
    return process.env.PLATFORM_ANTHROPIC_API_KEY;
  }
  if (provider === 'sumopod' && process.env.SUMOPOD_API_KEY) {
    return process.env.SUMOPOD_API_KEY;
  }
  if (provider === 'deepseek' && process.env.DEEPSEEK_API_KEY) {
    return process.env.DEEPSEEK_API_KEY;
  }
  throw new Error(`No API key configured for provider "${provider}"`);
}

/** Resolves the LLM for a task via the provider registry, then wraps it as a LangChain chat model. */
export async function getChatModel(task: LlmTask, opts: GetChatModelOptions = {}): Promise<BaseChatModel> {
  const { provider, model, apiKeyId } = providerRegistry.select('llm-text', {
    project: opts.project,
    override: opts.override,
  });
  const apiKey = await resolveApiKey(opts.projectId, provider, apiKeyId);
  const temperature = TASK_TEMPERATURE[task];

  switch (provider) {
    case 'anthropic':
      return new ChatAnthropic({ apiKey, model, temperature });
    case 'openai':
      return new ChatOpenAI({ apiKey, model, temperature });
    case 'sumopod':
      return createSumopodChatModel({ apiKey, model, temperature });
    case 'deepseek':
      return createDeepseekChatModel({ apiKey, model, temperature });
    default:
      throw new Error(`No LangChain chat model wrapper for provider "${provider}"`);
  }
}
