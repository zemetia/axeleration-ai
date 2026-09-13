export interface ProjectBriefInput {
  tags?: string[];
  targetAudience?: string | null;
  tone?: string | null;
  visualStyle?: string | null;
  language?: string | null;
}

/**
 * Condenses the optional project fields into the few lines every creative prompt needs.
 * Blank fields are dropped rather than sent as "(none)" so the model is not primed with empties;
 * returns `'(none)'` only when the user filled in nothing at all.
 */
export function buildProjectBrief(input: ProjectBriefInput): string {
  const lines: string[] = [];
  if (input.tags?.length) lines.push(`Genre / look tags: ${input.tags.join(', ')}`);
  if (input.targetAudience) lines.push(`Target audience: ${input.targetAudience}`);
  if (input.tone) lines.push(`Tone: ${input.tone}`);
  if (input.visualStyle) lines.push(`Visual style: ${input.visualStyle}`);
  if (input.language) lines.push(`Language for narration and dialogue: ${input.language}`);
  return lines.length > 0 ? lines.join('\n') : '(none)';
}
