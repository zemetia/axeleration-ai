import type { AspectRatio, ProjectType, ResearchMode, Resolution } from '@prisma/client';

/**
 * Single source of truth for the human-facing labels of every project enum.
 * Imported by the wizard, the edit form, the project card and the detail page so a label
 * never drifts between the place it is picked and the places it is displayed.
 */

export interface Option<T extends string> {
  value: T;
  label: string;
  description?: string;
}

export const PROJECT_TYPE_OPTIONS: Option<ProjectType>[] = [
  {
    value: 'EPISODIC',
    label: 'Episodic',
    description: 'A continuing series — every episode carries the previous one’s continuity forward.',
  },
  {
    value: 'NON_CONTINUOUS',
    label: 'Non-continuous',
    description: 'Standalone videos that share a look and cast but no running storyline.',
  },
];

export const PROJECT_TYPE_LABELS: Record<ProjectType, string> = {
  EPISODIC: 'Episodic',
  NON_CONTINUOUS: 'Non-continuous',
};

export const RESEARCH_MODE_OPTIONS: Option<ResearchMode>[] = [
  { value: 'AI_CDP', label: 'AI web research', description: 'Browses the web for grounded detail.' },
  { value: 'AI_REASONING', label: 'AI reasoning', description: 'Brainstorms from the premise only.' },
  { value: 'HUMAN', label: 'Human notes', description: 'You paste the context yourself.' },
  { value: 'SKIP', label: 'Skip', description: 'No research stage at all.' },
];

export const RESEARCH_MODE_LABELS: Record<ResearchMode, string> = {
  AI_CDP: 'AI web research',
  AI_REASONING: 'AI reasoning',
  HUMAN: 'Human notes',
  SKIP: 'Skip',
};

export const ASPECT_RATIO_OPTIONS: Option<AspectRatio>[] = [
  { value: 'R9_16', label: '9:16 — Vertical (Reels / Shorts)' },
  { value: 'R16_9', label: '16:9 — Widescreen' },
  { value: 'R1_1', label: '1:1 — Square' },
];

export const ASPECT_RATIO_LABELS: Record<AspectRatio, string> = {
  R9_16: '9:16',
  R16_9: '16:9',
  R1_1: '1:1',
};

export const RESOLUTION_OPTIONS: Option<Resolution>[] = [
  { value: 'P720', label: '720p' },
  { value: 'P1080', label: '1080p' },
  { value: 'P4K', label: '4K' },
];

export const RESOLUTION_LABELS: Record<Resolution, string> = {
  P720: '720p',
  P1080: '1080p',
  P4K: '4K',
};
