import { ChatPromptTemplate } from '@langchain/core/prompts';

/**
 * `AI_REASONING` mode of the RESEARCH stage: pure brainstorm from what the model already knows —
 * no tools, no web access. Distinct from `AI_CDP` (src/ai/research/research-agent.ts), which is
 * for when the idea needs to be grounded in real, current, source-backed facts.
 */
export interface IdeaResearchPromptInput {
  premise: string;
  projectType: string;
  continuitySummary: string;
  episodeNumber: number;
}

export const ideaResearchPrompt = ChatPromptTemplate.fromMessages([
  [
    'system',
    'You are a writers-room assistant for a {projectType} video series. Given the premise and what has ' +
      'happened so far, brainstorm 2-4 concrete angles or hooks the next episode could explore. ' +
      'Do not write the episode itself — just the raw material an idea-writer could use. ' +
      'Short bullet-style sentences, no preamble.',
  ],
  [
    'human',
    'Premise: {premise}\n\n' +
      'Continuity so far (may be empty for episode 1): {continuitySummary}\n\n' +
      'This is episode {episodeNumber}. What angles are worth exploring?',
  ],
]);
