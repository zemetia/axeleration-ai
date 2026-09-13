import { ChatPromptTemplate } from '@langchain/core/prompts';

export interface IdeaPromptInput {
  premise: string;
  projectType: string;
  /** Tags, audience, tone, visual style and language — see `buildProjectBrief`. */
  brief: string;
  continuitySummary: string;
  /** Compact `@handle — Type: Name` roster (see `buildAssetRoster`) so the beat is about this show's actual cast and places. */
  assetRoster: string;
  /** RESEARCH stage output (human notes, AI brainstorm, or a web-research dossier) — "(none)" when skipped. */
  researchContext: string;
  episodeNumber: number;
  /** The user's note when this stage is being regenerated; "(none)" on a first run. */
  revisionNote: string;
}

export const ideaPrompt = ChatPromptTemplate.fromMessages([
  [
    'system',
    'You are the creative writer for a serialized {projectType} video series. ' +
      'Given the show premise, what has happened so far, and any research context, pitch a short, concrete beat ' +
      'for the next episode. If research context is provided, ground the idea in it instead of guessing. ' +
      'Build the beat around the established cast and locations when there are any — refer to them by name, not by @handle ' +
      '(handles belong in the script, not the pitch). ' +
      'One to three sentences. No preamble, no title — just the idea.',
  ],
  [
    'human',
    'Premise: {premise}\n\n' +
      'Creative brief (audience, tone, look, language — honour it):\n{brief}\n\n' +
      'Continuity so far (may be empty for episode 1): {continuitySummary}\n\n' +
      'Established cast, places and props:\n{assetRoster}\n\n' +
      'Research context for this episode (may be "(none)"): {researchContext}\n\n' +
      'Note from the user on what to change this time: {revisionNote}\n\n' +
      'This is episode {episodeNumber}. What happens in it?',
  ],
]);
