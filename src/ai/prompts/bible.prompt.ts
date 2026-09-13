import { z } from 'zod';

/**
 * Identity lock: the structured, reusable description of who/what appears in this series.
 * Every SCRIPT and SCENES prompt is fed these traits verbatim so a character does not drift
 * between episodes — that consistency is the whole point of the character bible.
 */
export const lockedTraitsSchema = z.object({
  characters: z
    .array(
      z.object({
        handle: z.string().describe('kebab-case handle this character is mentioned by, e.g. "luna"'),
        name: z.string(),
        appearance: z.string().describe('Face, hair, build, age read — concrete and visual, no backstory'),
        outfit: z.string().describe('Default outfit, described so it can be redrawn identically'),
        palette: z.array(z.string()).describe('Signature colors, in plain words, e.g. "muted teal"'),
      }),
    )
    .min(1),
  styleNotes: z.string().describe('Rendering style, lighting, camera feel shared by every shot'),
  negativePrompt: z.string().optional().describe('What must never appear'),
});

export type LockedTraits = z.infer<typeof lockedTraitsSchema>;

export const BIBLE_SYSTEM_PROMPT =
  'You lock the visual identity of a video series so it can be regenerated consistently forever. ' +
  'Describe only what a renderer can draw: appearance, outfit, palette, style. No plot, no backstory, no adjectives about personality. ' +
  'Be specific enough that two different image models would produce recognizably the same character. ' +
  // Spelled out for `.withStructuredOutput(schema, { method: 'jsonMode' })` (see `bible-chain.ts`) —
  // jsonMode sends only `{ type: 'json_object' }`, not the schema, so this is the model's only source
  // for the field names. "JSON" has to appear literally too, or some OpenAI-compatible APIs reject
  // the `json_object` response_format outright.
  'Respond with a single JSON object — no prose, no markdown fences — shaped exactly like this: ' +
  '{ "characters": [{ "handle": string, "name": string, "appearance": string, "outfit": string, "palette": string[] }], ' +
  '"styleNotes": string, "negativePrompt"?: string }';

export function bibleUserPrompt(input: {
  projectType: string;
  premise: string;
  /** Tags, audience, tone, visual style and language — see `buildProjectBrief`. */
  brief: string;
  hasSeedImage: boolean;
}): string {
  return [
    `Series type: ${input.projectType}`,
    `Premise: ${input.premise}`,
    `Creative brief:\n${input.brief}`,
    input.hasSeedImage
      ? 'A reference image of the main character is attached — derive the locked traits from it and keep them faithful to the image.'
      : 'No reference image was provided — invent a coherent main character that fits the premise.',
    'Produce the locked traits.',
  ].join('\n\n');
}
