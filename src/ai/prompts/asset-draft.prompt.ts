import { ChatPromptTemplate } from '@langchain/core/prompts';
import { z } from 'zod';

import { assetSchemaOf } from '@/config/asset-schema';
import type { AssetType } from '@prisma/client';

/**
 * Turns the lab's base prompt into a filled-in asset.
 *
 * The field set is per-type and data-driven, so both the schema handed to the model and the field
 * manifest in the prompt are generated from `asset-schema.ts` — a field added there is drafted
 * without touching this file. Every attribute is optional on purpose: a model that is forced to
 * emit all thirty keys invents an eye colour for a map.
 */

export function assetDraftSchemaOf(type: AssetType) {
  // The allowed keys are named in the schema as well as in the prompt: a structured-output call
  // that only sees "a record of strings" happily invents keys, and every invented one is dropped
  // on normalization — i.e. silently lost work.
  const keys = assetSchemaOf(type)
    .sections.flatMap((section) => section.fields.map((field) => field.key))
    .join(', ');

  return z.object({
    name: z.string().describe('Short display name for this asset. Two or three words.'),
    description: z
      .string()
      .describe('One or two sentences describing the asset. This is the lead line of every prompt it appears in.'),
    attributes: z
      .record(z.string(), z.union([z.string(), z.array(z.string())]))
      .describe(
        `Only these keys, all optional: ${keys}. Prose fields are strings; tag fields are arrays of short strings.`,
      ),
  });
}

export type AssetDraftOutput = z.infer<ReturnType<typeof assetDraftSchemaOf>>;

/** The per-type field list, rendered for the prompt: key, label, what kind of value, allowed options. */
export function assetFieldManifest(type: AssetType): string {
  return assetSchemaOf(type)
    .sections.map((section) => {
      const fields = section.fields
        .map((field) => {
          const kind =
            field.kind === 'tags'
              ? 'array of short strings'
              : field.kind === 'select'
                ? `one of: ${(field.options ?? []).join(' | ')}`
                : field.kind === 'textarea'
                  ? 'string, one to three sentences'
                  : 'string, a few words';
          return `  - ${field.key} (${field.label}): ${kind}`;
        })
        .join('\n');
      return `${section.title}\n${fields}`;
    })
    .join('\n\n');
}

export const assetDraftPrompt = ChatPromptTemplate.fromMessages([
  [
    'system',
    'You are an art department lead filling in a {typeLabel} asset for an AI video production. ' +
      'The user gives you a short brief; you turn it into a complete, concrete, production-ready specification.\n\n' +
      'Rules:\n' +
      '- Fill only the fields listed below, using their exact keys. Leave a field out entirely rather than ' +
      'writing "unknown", "n/a", or a restatement of the brief.\n' +
      '- For fields with an allowed option list, use one of those exact strings or omit the field.\n' +
      '- Be specific and visual. "Weathered brass, green at the seams" beats "old metal". Every value ends ' +
      'up in an image prompt, so anything unobservable is wasted.\n' +
      '- Stay inside the brief. Invent the detail it leaves unsaid; never contradict what it says.\n' +
      '- Write in English, no matter what language the brief is in.\n\n' +
      'Field list:\n{fieldManifest}\n\n' +
      // Spelled out for `.withStructuredOutput(schema, { method: 'jsonMode' })` (see
      // `asset-draft-chain.ts`) — jsonMode sends only `{ type: 'json_object' }`, not the schema, so
      // this is the model's only source for the field names. "JSON" has to appear literally too, or
      // some OpenAI-compatible APIs reject the `json_object` response_format outright.
      // Braces are doubled — this is a ChatPromptTemplate f-string; see `script.prompt.ts`.
      'Respond with a single JSON object — no prose, no markdown fences — shaped exactly like this: ' +
      '{{ "name": string, "description": string, "attributes": {{ <only the keys from the field list above>: string | string[] }} }}',
  ],
  [
    'human',
    'Project context: {projectContext}\n\nBrief for this {typeLabel}:\n{basePrompt}\n\n{existingNote}',
  ],
]);
