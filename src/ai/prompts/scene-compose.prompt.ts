import { ChatPromptTemplate } from '@langchain/core/prompts';

export interface SceneComposePromptInput {
  /** The beat rendered by `formatScenePrompt` — the seven blocks exactly as the user wrote them. */
  sceneBlocks: string;
  /** `Shot 1: 0-3s` … — restated separately so the model cannot quietly re-time the cut. */
  shotTimings: string;
  /** The clip's total running time in seconds; the last shot must end here. */
  durationSeconds: number;
  characterBible: string;
  /** The project's `@handle` vocabulary — see `buildAssetRoster`. */
  assetRoster: string;
  styleConfig: string; // JSON.stringify(project.styleConfig), or "none"
  aspectRatio: string;
  /** Source-backed findings from the research agent (see `src/ai/research/`); "none" when it didn't run. */
  researchContext: string;
  /** The user's note when this stage is being regenerated; "(none)" on a first run. */
  revisionNote: string;
}

/**
 * Finishes one beat into the prompt that is actually sent.
 *
 * The block format is the contract in both directions: the draft going in is what the editor shows,
 * and the text coming back must be the same seven blocks, so "the prompt actually sent" stays
 * readable against the form that produced it. The model's job is the enrichment a form field can't
 * carry — the character bible's fixed looks, the project's style config, grounded research detail —
 * and *never* re-cutting the scene, because the shot windows are what the clip is generated to.
 */
export const sceneComposePrompt = ChatPromptTemplate.fromMessages([
  [
    'system',
    'You finish a single video generation prompt from a draft that is already written in blocks. ' +
      'Reply with blocks in this order, each on its own line after its header, and nothing else — ' +
      'no commentary, no markdown fences: [STYLE], [SETTING], [SHOTS], [LIGHTING], [AUDIO], [DIALOGUE], [NEGATIVE]. ' +
      'This is one clip, not a sequence of scenes: keep the shot list, its order and its "Shot N (X-Ys):" timings exactly as given, ' +
      'ending at {durationSeconds}s, with "Cut to:" between consecutive shots. ' +
      'Keep what the draft already says and add only what is missing — never contradict it. ' +
      'A block the draft leaves out is one the writer did not ask for: add it back only when the bible, style config or research ' +
      'gives you something real to put there, and otherwise leave it out entirely rather than writing an empty or filler block. ' +
      '[DIALOGUE] is the exception — it must always be present, and reads exactly "none" when the clip has no spoken lines. ' +
      '[AUDIO] stays non-verbal (ambience, effects, score) because spoken words belong to [DIALOGUE] alone. ' +
      'Preserve any "@handle" mentions verbatim — they resolve to a stored reference asset downstream, never describe them yourself. ' +
      'When the draft names something that is in the asset roster but was written out in words, replace it with that asset\'s @handle: ' +
      'the handle is what keeps a character or place looking the same across every shot and every episode. Use only roster handles. ' +
      'Weave the character bible and style config into [STYLE], [SETTING] and [LIGHTING] as visual detail. ' +
      'When research findings are provided, ground concrete details (setting, era, objects, wardrobe) in them instead of guessing.',
  ],
  [
    'human',
    'The draft prompt:\n{sceneBlocks}\n\n' +
      'Shot timings that must not change:\n{shotTimings}\n' +
      'Total clip length: {durationSeconds}s\n' +
      'Character bible: {characterBible}\n' +
      'Asset roster — the only @handles that exist:\n{assetRoster}\n' +
      'Style config: {styleConfig}\n' +
      'Aspect ratio: {aspectRatio}\n' +
      'Research findings: {researchContext}\n' +
      'Note from the user on what to change this time: {revisionNote}',
  ],
]);
