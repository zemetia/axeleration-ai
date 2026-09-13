import { z } from 'zod';

/**
 * What the research agent hands to the SCENES node: not raw search results, but a compiled,
 * source-backed dossier a scene-compose prompt can quote from directly.
 */
export const researchSourceSchema = z.object({
  url: z.string().url(),
  title: z.string().optional(),
});

export const researchFindingSchema = z.object({
  claim: z.string().describe('One concrete, checkable fact or visual detail'),
  detail: z.string().describe('Supporting specifics — numbers, names, colors, dates, whatever grounds the claim'),
  sources: z.array(researchSourceSchema).default([]).describe('Every source that backs this claim'),
});

export const researchDossierSchema = z.object({
  summary: z.string().describe('2-4 sentence brief a scene-composer can read before writing any prompt'),
  findings: z.array(researchFindingSchema).min(1),
  visualReferences: z
    .array(z.object({ url: z.string().url(), description: z.string() }))
    .default([])
    .describe('Concrete pages/images worth using as a visual reference for scene composition'),
  openQuestions: z.array(z.string()).default([]).describe('What research could not confirm — flag it instead of inventing an answer'),
});

export type ResearchSource = z.infer<typeof researchSourceSchema>;
export type ResearchFinding = z.infer<typeof researchFindingSchema>;
export type ResearchDossier = z.infer<typeof researchDossierSchema>;
