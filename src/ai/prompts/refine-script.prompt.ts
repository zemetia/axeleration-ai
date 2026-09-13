import { ChatPromptTemplate } from '@langchain/core/prompts';

import { SCENE_BLOCK_GUIDE, SCENE_BREAKDOWN_JSON_SHAPE } from './script.prompt';

/**
 * Improve the scene breakdown that is already there, rather than writing a new one.
 *
 * `scriptPrompt` never receives the current breakdown — Regenerate means "cut a different script
 * from this idea". This is the other half, selected by the `scriptMode` channel (see
 * `nodes/script.node.ts`): keep the beats, the dialogue and the pacing the user already reviewed,
 * and only change what the note asks for.
 *
 * Inputs mirror `ScriptPromptInput` so the two are interchangeable at the call site, plus the
 * breakdown being revised.
 */
export interface RefineScriptPromptInput {
  idea: string;
  characterBible: string; // JSON.stringify(lockedTraits), or "no character bible yet"
  /** The project's `@handle` vocabulary — see `buildAssetRoster`. Without it the handle rule below is unusable. */
  assetRoster: string;
  targetTotalSeconds: number;
  aspectRatio: string;
  /** The breakdown being revised, as JSON — same shape `sceneBreakdownSchema` produces. */
  currentScript: string;
  /** What the user asked for in the Refine dialog; "(none)" when they just pressed the button. */
  userNote: string;
}

export const refineScriptPrompt = ChatPromptTemplate.fromMessages([
  [
    'system',
    'You revise an existing scene-by-scene shooting script for a serialized video episode. ' +
      'This is a revision, not a replacement: keep the scene count, order, shot timings and dialogue as ' +
      'close to the original as you can, and change only what the note asks for. ' +
      'Keep every character exactly as described in the character bible — do not invent new traits. ' +
      'Reference an established asset by writing its "@handle" verbatim inside a setting, a shot action or a dialogue line — ' +
      'every asset in the roster below is a fixed look the pipeline will pin the shot to, so mention the handle instead of ' +
      're-describing that character, location or prop in your own words. Use only handles from the roster; invent none. ' +
      'Keep the total duration at about {targetTotalSeconds} seconds, framed for a {aspectRatio} video. ' +
      'Reply with the complete revised scene breakdown and nothing else — no commentary on what changed. ' +
      SCENE_BREAKDOWN_JSON_SHAPE +
      ' ' +
      SCENE_BLOCK_GUIDE,
  ],
  [
    'human',
    'Episode idea: {idea}\n\n' +
      'Character bible (locked traits): {characterBible}\n\n' +
      'Asset roster — the only @handles that exist:\n{assetRoster}\n\n' +
      'The scene breakdown to revise (JSON):\n{currentScript}\n\n' +
      'What the user wants changed: {userNote}\n\n' +
      'Write the revised scene breakdown.',
  ],
]);
