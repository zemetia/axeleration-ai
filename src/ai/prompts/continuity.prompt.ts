import { ChatPromptTemplate } from '@langchain/core/prompts';

export interface ContinuityPromptInput {
  previousSummary: string;
  episodeNumber: number;
  episodeEvents: string; // logline + scene beats of the episode that just finished
  maxChars: number;
}

export const continuityPrompt = ChatPromptTemplate.fromMessages([
  [
    'system',
    'You maintain a rolling continuity summary for a serialized video series — never a transcript, never a log. ' +
      'Re-summarize: fold the new episode into what is already known, drop detail that no longer matters, ' +
      'keep only what a writer needs to pitch the next episode. ' +
      'Hard limit: {maxChars} characters. Plain prose, no headings.',
  ],
  [
    'human',
    'Current summary: {previousSummary}\n\n' + 'Episode {episodeNumber} just happened: {episodeEvents}\n\n' + 'Write the updated summary.',
  ],
]);
