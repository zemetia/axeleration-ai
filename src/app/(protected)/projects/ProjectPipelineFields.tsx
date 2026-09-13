'use client';

import { OptionCardGroup } from '@/components/ui/OptionCardGroup';
import { RESEARCH_MODE_OPTIONS } from '@/config/project-options';
import type { ResearchMode } from '@prisma/client';

import type { ProjectFieldsProps } from './ProjectBasicsFields';

type AudioMode = 'generate' | 'skip';

const AUDIO_MODE_OPTIONS: { value: AudioMode; label: string; description: string }[] = [
  { value: 'generate', label: 'Generate audio', description: 'Narration and a music bed are produced and mixed in.' },
  { value: 'skip', label: 'Video only', description: 'Voice and music stages complete instantly and cost nothing.' },
];

export function ProjectPipelineFields({ value, onChange, errors }: ProjectFieldsProps) {
  return (
    <div className="flex flex-col gap-6">
      <OptionCardGroup
        label="Default research mode"
        hint="How new episodes source context for their IDEA stage — overridable per episode."
        options={RESEARCH_MODE_OPTIONS}
        value={value.defaultResearchMode}
        onChange={(defaultResearchMode: ResearchMode) => onChange({ defaultResearchMode })}
        error={errors?.['defaultResearchMode']?.[0]}
      />

      <OptionCardGroup
        label="Audio"
        hint="Turn audio off while you are iterating on the visuals — every render otherwise pays for a voice track and a music track you are not listening to yet. Clips that arrive with their own audio keep it either way."
        options={AUDIO_MODE_OPTIONS}
        value={value.skipAudio ? 'skip' : 'generate'}
        onChange={(mode: AudioMode) => onChange({ skipAudio: mode === 'skip' })}
        error={errors?.['pipelineConfig']?.[0]}
      />
    </div>
  );
}
ProjectPipelineFields.displayName = 'ProjectPipelineFields';
