'use client';

import { OptionCardGroup } from '@/components/ui/OptionCardGroup';
import { TagsInput } from '@/components/ui/TagsInput';
import { TextInputField } from '@/components/ui/TextInputField';
import { PROJECT_TYPE_OPTIONS } from '@/config/project-options';
import { MAX_PROJECT_TAGS, PROJECT_TAG_SUGGESTIONS } from '@/lib/validations';
import type { ProjectType } from '@prisma/client';

import type { ProjectDraft } from './project-draft';

export interface ProjectFieldsProps {
  value: ProjectDraft;
  onChange: (patch: Partial<ProjectDraft>) => void;
  errors?: Record<string, string[]>;
}

export function ProjectBasicsFields({ value, onChange, errors }: ProjectFieldsProps) {
  return (
    <div className="flex flex-col gap-6">
      <TextInputField
        label="Project name"
        placeholder="Luna and the Night Market"
        hint="Shown on your dashboard — this is not the episode title."
        value={value.name}
        onChange={(name) => onChange({ name })}
        isRequired
        error={errors?.['name']?.[0]}
      />

      <OptionCardGroup
        label="Project type"
        hint="Episodic keeps continuity between episodes; non-continuous treats each video as its own story."
        options={PROJECT_TYPE_OPTIONS}
        value={value.type}
        onChange={(type: ProjectType) => onChange({ type })}
        error={errors?.['type']?.[0]}
      />

      <TagsInput
        label="Tags"
        hint={`Genre and look — comma separated, up to ${MAX_PROJECT_TAGS}. Type your own or pick a suggestion.`}
        value={value.tags}
        onChange={(tags) => onChange({ tags })}
        suggestions={PROJECT_TAG_SUGGESTIONS}
        maxTags={MAX_PROJECT_TAGS}
        error={errors?.['tags']?.[0]}
      />

      <TextInputField
        label="Logline"
        placeholder="A shy girl discovers the night market only opens for people who are lost."
        hint="Optional one-liner shown on the project card."
        value={value.logline}
        onChange={(logline) => onChange({ logline })}
        error={errors?.['logline']?.[0]}
      />
    </div>
  );
}
ProjectBasicsFields.displayName = 'ProjectBasicsFields';
