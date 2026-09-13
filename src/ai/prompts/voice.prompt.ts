import { ChatPromptTemplate } from '@langchain/core/prompts';
import { z } from 'zod';

export const voiceLinesSchema = z.object({
  lines: z.array(z.object({ speaker: z.string(), text: z.string() })),
});
export type VoiceLines = z.infer<typeof voiceLinesSchema>;

export interface VoicePromptInput {
  scriptDialogue: string; // JSON.stringify of {speaker, line}[] pulled from every scene
}

export const voicePrompt = ChatPromptTemplate.fromMessages([
  [
    'system',
    'Turn this script\'s dialogue and narration into a flat, ordered list of TTS lines. ' +
      'Merge consecutive lines from the same speaker. Keep wording verbatim — you are formatting, not rewriting. ' +
      // Spelled out for `.withStructuredOutput(schema, { method: 'jsonMode' })` (see `voice.node.ts`)
      // — jsonMode sends only `{ type: 'json_object' }`, not the schema, so this is the model's only
      // source for the field names. "JSON" has to appear literally too, or some OpenAI-compatible
      // APIs reject the `json_object` response_format outright.
      // Braces are doubled — this is a ChatPromptTemplate f-string; see `script.prompt.ts`.
      'Respond with a single JSON object — no prose, no markdown fences — shaped exactly like this: ' +
      '{{ "lines": [{{ "speaker": string, "text": string }}] }}',
  ],
  ['human', 'Dialogue (in scene order): {scriptDialogue}'],
]);
