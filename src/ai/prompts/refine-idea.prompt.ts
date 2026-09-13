import { ChatPromptTemplate } from '@langchain/core/prompts';

/**
 * Improve the idea that is already there, rather than writing a new one.
 *
 * `ideaPrompt` never receives the current idea — by design, because Regenerate means "give me a
 * different episode". That left no way to say "keep this, just make the ending land harder": the
 * note steered a fresh write and the paragraph on screen was discarded either way. This prompt is
 * the other half, selected by the `ideaMode` channel (see `nodes/idea.node.ts`).
 *
 * Inputs mirror `IdeaPromptInput` so the two are interchangeable at the call site, plus the three
 * things a revision needs: what to revise, what the user asked for, and what the critic objected to.
 */
export interface RefineIdeaPromptInput {
  premise: string;
  projectType: string;
  /** Tags, audience, tone, visual style and language — see `buildProjectBrief`. */
  brief: string;
  continuitySummary: string;
  /** Compact `@handle — Type: Name` roster (see `buildAssetRoster`). */
  assetRoster: string;
  /** RESEARCH stage output — "(none)" when skipped. */
  researchContext: string;
  episodeNumber: number;
  /** The idea being revised. The node guarantees this is non-empty — an empty one falls back to a fresh write. */
  currentIdea: string;
  /** What the user asked for in the Refine dialog; "(none)" when they just pressed the button. */
  userNote: string;
  /** The critic's weaknesses and open questions, formatted; "(none)" until T19 runs a real critic. */
  critique: string;
}

export const refineIdeaPrompt = ChatPromptTemplate.fromMessages([
  [
    'system',
    'You revise an existing episode idea for a serialized {projectType} video series. ' +
      'This is a revision, not a replacement: keep the premise, the cast, the setting and the ending of the ' +
      'current idea intact unless the note or the critique explicitly asks for one of them to change. ' +
      'Change what the note and the critique point at, and leave the rest as close to the original as you can. ' +
      'Refer to cast and locations by name, not by @handle (handles belong in the script, not the pitch). ' +
      // Without this the model narrates its own edits ("I strengthened the ending by…") and that
      // commentary is what gets stored as the idea — the node has no way to tell prose from a report.
      'Reply with the complete revised idea and nothing else: no diff, no list of changes, no preamble, no title. ' +
      'One to three sentences, the same shape as what you were given.',
  ],
  [
    'human',
    'Premise: {premise}\n\n' +
      'Creative brief (audience, tone, look, language — honour it):\n{brief}\n\n' +
      'Continuity so far (may be empty for episode 1): {continuitySummary}\n\n' +
      'Established cast, places and props:\n{assetRoster}\n\n' +
      'Research context for this episode (may be "(none)"): {researchContext}\n\n' +
      'This is episode {episodeNumber}.\n\n' +
      'The idea to revise:\n{currentIdea}\n\n' +
      'What the user wants changed: {userNote}\n\n' +
      'What the critic flagged (may be "(none)"): {critique}\n\n' +
      'Write the revised idea.',
  ],
]);
