'use client';

import { Sparkles } from 'lucide-react';
import { useState } from 'react';

import { useRefinePremise } from '@/hooks/queries';
import { TextAreaField } from '@/components/ui/TextAreaField';
import { TextInputField } from '@/components/ui/TextInputField';

import type { ProjectFieldsProps } from './ProjectBasicsFields';

export function ProjectStoryFields({ value, onChange, errors }: ProjectFieldsProps) {
  const refinePremise = useRefinePremise();
  const [refineError, setRefineError] = useState<string>();

  async function handleRefine() {
    setRefineError(undefined);
    const result = await refinePremise.mutateAsync({
      premise: value.premise,
      projectType: value.type,
    });
    if (result.premise) {
      onChange({ premise: result.premise });
    } else {
      setRefineError(result.message ?? 'Could not refine the premise');
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <TextAreaField
        label="Premise"
        labelAction={
          <button
            type="button"
            onClick={handleRefine}
            disabled={!value.premise.trim() || refinePremise.isPending}
            className="text-primary-text inline-flex items-center gap-1 text-xs font-medium transition-opacity hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Sparkles aria-hidden className="size-3.5" />
            {refinePremise.isPending ? 'Refining…' : 'Refine with AI'}
          </button>
        }
        hint="The one-paragraph story concept the AI writer builds every episode from."
        placeholder="Luna runs a lantern stall in a night market that only appears for travellers who have lost their way…"
        value={value.premise}
        onChange={(premise) => onChange({ premise })}
        isRequired
        rows={5}
        error={errors?.['premise']?.[0] ?? refineError}
      />

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <TextInputField
          label="Target audience"
          placeholder="Kids 6–10"
          hint="Who this is for — steers vocabulary and pacing."
          value={value.targetAudience}
          onChange={(targetAudience) => onChange({ targetAudience })}
          error={errors?.['targetAudience']?.[0]}
        />
        <TextInputField
          label="Tone"
          placeholder="Warm, gently funny"
          hint="How it should feel."
          value={value.tone}
          onChange={(tone) => onChange({ tone })}
          error={errors?.['tone']?.[0]}
        />
      </div>

      <TextAreaField
        label="Visual style"
        hint="Rendering, lighting and camera notes carried into the character bible and every shot."
        placeholder="Hand-painted 2D, soft rim light, shallow depth of field, muted teal and amber palette."
        value={value.visualStyle}
        onChange={(visualStyle) => onChange({ visualStyle })}
        rows={3}
        error={errors?.['visualStyle']?.[0]}
      />

      <TextInputField
        label="Language"
        placeholder="English"
        hint="Language the narration and dialogue are written in."
        value={value.language}
        onChange={(language) => onChange({ language })}
        isRequired
        error={errors?.['language']?.[0]}
      />
    </div>
  );
}
ProjectStoryFields.displayName = 'ProjectStoryFields';
