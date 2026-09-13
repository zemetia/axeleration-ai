import { AspectRatio, ProjectType, ResearchMode, Resolution } from '@prisma/client';
import { z } from 'zod';

/** Suggestions offered in the tag input — users are free to type anything else. */
export const PROJECT_TAG_SUGGESTIONS = [
  'cartoon',
  'anime',
  'realistic',
  '3d',
  'documentary',
  'comedy',
  'educational',
] as const;

export const MAX_PROJECT_TAGS = 12;

/**
 * Tags are entered comma-separated. Normalize to lowercase, trim, drop blanks and duplicates
 * so `"Anime, anime , cartoon"` stores as `['anime', 'cartoon']`.
 */
export function normalizeTags(input: string | string[]): string[] {
  const parts = Array.isArray(input) ? input : input.split(',');
  const seen = new Set<string>();
  for (const part of parts) {
    const tag = part.trim().toLowerCase();
    if (tag) seen.add(tag);
  }
  return [...seen];
}

const tagsSchema = z
  .union([z.string(), z.array(z.string())])
  .transform(normalizeTags)
  .pipe(
    z
      .array(z.string().max(32, 'Each tag must be 32 characters or fewer'))
      .max(MAX_PROJECT_TAGS, `At most ${MAX_PROJECT_TAGS} tags`),
  );

const projectBaseSchema = z.object({
  name: z.string().min(1, 'Name is required').max(120, 'Name is too long').trim(),
  type: z.nativeEnum(ProjectType),
  tags: tagsSchema.default([]),
  logline: z.string().max(200, 'Logline is too long').trim().default(''),
  premise: z.string().min(1, 'Premise is required').max(4000, 'Premise is too long'),
  targetAudience: z.string().max(120, 'Target audience is too long').trim().default(''),
  tone: z.string().max(120, 'Tone is too long').trim().default(''),
  visualStyle: z.string().max(2000, 'Visual style is too long').trim().default(''),
  language: z
    .string()
    .min(1, 'Language is required')
    .max(40, 'Language is too long')
    .trim()
    .default('English'),
  aspectRatio: z.nativeEnum(AspectRatio).default('R9_16'),
  resolution: z.nativeEnum(Resolution).default('P1080'),
  targetTotalSeconds: z.coerce.number().int().min(1).max(3600),
  sceneDurationMin: z.coerce.number().int().min(1).max(120),
  sceneDurationMax: z.coerce.number().int().min(1).max(120),
  /** Default RESEARCH stage mode for new episodes of this project — overridable per-episode. */
  defaultResearchMode: z.nativeEnum(ResearchMode).default('AI_CDP'),
  styleConfig: z.record(z.string(), z.unknown()).optional(),
  modelConfig: z.record(z.string(), z.unknown()).optional(),
  /** Pipeline switches (currently `{ skipAudio }`) — shape owned by `src/config/pipeline-config.ts`. */
  pipelineConfig: z.record(z.string(), z.unknown()).optional(),
});

function sceneDurationOrdered(data: { sceneDurationMin?: number; sceneDurationMax?: number }) {
  if (data.sceneDurationMin === undefined || data.sceneDurationMax === undefined) return true;
  return data.sceneDurationMin <= data.sceneDurationMax;
}

export const projectSchema = projectBaseSchema.refine(sceneDurationOrdered, {
  message: 'Minimum scene duration must be less than or equal to the maximum',
  path: ['sceneDurationMax'],
});

export const projectUpdateSchema = projectBaseSchema.partial().refine(sceneDurationOrdered, {
  message: 'Minimum scene duration must be less than or equal to the maximum',
  path: ['sceneDurationMax'],
});

export type ProjectInput = z.infer<typeof projectSchema>;
export type ProjectUpdateInput = z.infer<typeof projectUpdateSchema>;
