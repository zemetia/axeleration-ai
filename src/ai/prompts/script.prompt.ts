import { ChatPromptTemplate } from '@langchain/core/prompts';

/**
 * Spells out `sceneBreakdownSchema`'s shape in words, for `.withStructuredOutput(schema, { method:
 * 'jsonMode' })` (see `nodes/script.node.ts`) — `jsonMode` sends only `{ type: 'json_object' }`, not
 * the schema itself, so the model has no other way to learn the field names. The word "JSON" has to
 * appear literally too: some OpenAI-compatible APIs reject a `json_object` response_format request
 * whose messages never mention it.
 *
 * ⚠️ Every literal brace is **doubled**. This string is interpolated into a `ChatPromptTemplate`,
 * whose f-string parser reads `{...}` as a variable slot — a single `{` or `}` throws
 * `Single '}' in template` at *module load*, which 500s every route that imports the prompt
 * (including `/api/inngest`, taking the whole pipeline down). `{{` / `}}` render as `{` / `}`.
 * Do not "clean up" the doubling. See `prompt-templates.test.ts`.
 */
export const SCENE_BREAKDOWN_JSON_SHAPE =
  'Respond with a single JSON object — no prose, no markdown fences — shaped exactly like this: ' +
  '{{ "logline": string, "scenes": [{{ "index": number, "style": string, "setting": string, ' +
  '"shots": [{{ "durationSeconds": number, "camera": string, "action": string }}], ' +
  '"lighting": string, "audio": string, ' +
  '"dialogue": [{{ "shot": number, "speaker": string, "delivery": string, "line": string }}], ' +
  '"negative": string }}] }}';

/**
 * What each block means. Kept beside the shape because a model given only field names writes a
 * "style" that is really a mood and an "audio" that is really dialogue — and every one of these
 * becomes a labelled block in the prompt a video model is finally handed.
 */
export const SCENE_BLOCK_GUIDE =
  'Each scene is one generated clip, never a sequence: "style" is film stock, grade, realism level and motion feel; ' +
  '"setting" is location, time of day, conditions and environment; "shots" are the cuts inside that one clip, in order, ' +
  'each with its own length in seconds, a camera framing + movement, and what the subject does; ' +
  '"lighting" is key light source, colour and contrast; "audio" is ambience, effects and score — non-verbal only; ' +
  '"dialogue" is the spoken lines, each pinned to the 1-based shot it lands on, with a delivery note for how it is said; ' +
  '"negative" is what the shot must avoid. Give a scene no dialogue by leaving the array empty. ' +
  'A scene\'s length is the sum of its shots, so do not send a scene-level duration.';

export interface ScriptPromptInput {
  idea: string;
  characterBible: string; // JSON.stringify(lockedTraits), or "no character bible yet"
  /** The project's `@handle` vocabulary — see `buildAssetRoster`. Without it the handle rule below is unusable. */
  assetRoster: string;
  targetScenes: number;
  targetTotalSeconds: number;
  aspectRatio: string;
  /** The user's note when this stage is being regenerated; "(none)" on a first run. */
  revisionNote: string;
}

export const scriptPrompt = ChatPromptTemplate.fromMessages([
  [
    'system',
    'You break an episode idea into a scene-by-scene shooting script. ' +
      'Keep every character exactly as described in the character bible — do not invent new traits. ' +
      'Reference an established asset by writing its "@handle" verbatim inside a setting, a shot action or a dialogue line — ' +
      'every asset in the roster below is a fixed look the pipeline will pin the shot to, so mention the handle instead of ' +
      're-describing that character, location or prop in your own words. Use only handles from the roster; invent none. ' +
      'Produce roughly {targetScenes} scenes whose shot durations sum to about {targetTotalSeconds} seconds in total, framed for a {aspectRatio} video. ' +
      SCENE_BREAKDOWN_JSON_SHAPE +
      ' ' +
      SCENE_BLOCK_GUIDE,
  ],
  [
    'human',
    'Episode idea: {idea}\n\n' +
      'Character bible (locked traits): {characterBible}\n\n' +
      'Asset roster — the only @handles that exist:\n{assetRoster}\n\n' +
      'Note from the user on what to change this time: {revisionNote}\n\n' +
      'Write the scene breakdown.',
  ],
]);
