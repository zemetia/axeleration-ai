import { readPipelineConfig } from '@/config/pipeline-config';
import type { ProjectInput } from '@/lib/validations';
import type { ProjectModelConfig } from '@/providers/types';
import type { ProjectVO } from '@/types/value-objects';
import type { AspectRatio, ProjectType, ResearchMode, Resolution } from '@prisma/client';

/** The shape the wizard and the edit form both hold in state — one flat, fully-controlled object. */
export interface ProjectDraft {
  name: string;
  type: ProjectType;
  tags: string[];
  logline: string;
  premise: string;
  targetAudience: string;
  tone: string;
  visualStyle: string;
  language: string;
  aspectRatio: AspectRatio;
  resolution: Resolution;
  targetTotalSeconds: number;
  sceneDurationMin: number;
  sceneDurationMax: number;
  defaultResearchMode: ResearchMode;
  /** Per-capability provider/model overrides — Chat, Image, Video, Voice each keep their own slot. */
  modelConfig: ProjectModelConfig;
  /** Flattened out of `pipelineConfig` — the draft is one flat object, the column is JSON. */
  skipAudio: boolean;
}

export const EMPTY_DRAFT: ProjectDraft = {
  name: '',
  type: 'EPISODIC',
  tags: [],
  logline: '',
  premise: '',
  targetAudience: '',
  tone: '',
  visualStyle: '',
  language: 'English',
  aspectRatio: 'R9_16',
  resolution: 'P1080',
  targetTotalSeconds: 60,
  sceneDurationMin: 4,
  sceneDurationMax: 8,
  defaultResearchMode: 'AI_CDP',
  modelConfig: {},
  skipAudio: false,
};

export function draftFromProject(project: ProjectVO): ProjectDraft {
  return {
    name: project.name,
    type: project.type,
    tags: project.tags,
    logline: project.logline,
    premise: project.premise,
    targetAudience: project.targetAudience,
    tone: project.tone,
    visualStyle: project.visualStyle,
    language: project.language,
    aspectRatio: project.aspectRatio,
    resolution: project.resolution,
    targetTotalSeconds: project.targetTotalSeconds,
    sceneDurationMin: project.sceneDurationMin,
    sceneDurationMax: project.sceneDurationMax,
    defaultResearchMode: project.defaultResearchMode,
    modelConfig: (project.modelConfig as ProjectModelConfig | null) ?? {},
    skipAudio: readPipelineConfig(project.pipelineConfig).skipAudio,
  };
}

/** The draft is already input-shaped apart from the pipeline switches; the server re-validates it. */
export function draftToInput(draft: ProjectDraft): ProjectInput {
  const { skipAudio, ...rest } = draft;
  return { ...rest, pipelineConfig: { skipAudio } };
}
