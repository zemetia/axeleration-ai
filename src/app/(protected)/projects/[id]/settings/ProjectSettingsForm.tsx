'use client';

import { Button } from '@/components/ui/Button';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { toast } from '@/hooks';
import { useUpdateProject } from '@/hooks/queries';
import type { ProjectVO } from '@/types/value-objects';

import { AiProviderFields } from '../../AiProviderFields';
import { ProjectBasicsFields, type ProjectFieldsProps } from '../../ProjectBasicsFields';
import { ProjectPipelineFields } from '../../ProjectPipelineFields';
import { ProjectStoryFields } from '../../ProjectStoryFields';
import { VideoConfigFields } from '../../VideoConfigFields';
import { draftFromProject, draftToInput, type ProjectDraft } from '../../project-draft';
import { SettingsPanel } from './SettingsPanel';

export type ProjectSettingsSection = 'general' | 'story' | 'video' | 'pipeline' | 'ai-providers';

const SECTIONS: Record<
  ProjectSettingsSection,
  { title: string; description: string; Fields: (props: ProjectFieldsProps) => React.ReactNode }
> = {
  general: {
    title: 'General',
    description: 'How this project is identified across the dashboard.',
    Fields: ProjectBasicsFields,
  },
  story: {
    title: 'Story',
    description: 'The creative brief every episode is written from.',
    Fields: ProjectStoryFields,
  },
  video: {
    title: 'Video',
    description: 'Output format and pacing targets for each episode.',
    Fields: VideoConfigFields,
  },
  pipeline: {
    title: 'Pipeline',
    description: 'Defaults the generation pipeline starts new episodes with.',
    Fields: ProjectPipelineFields,
  },
  'ai-providers': {
    title: 'AI providers',
    description:
      'Pick a provider and model per capability — Chat, Image, Video and Voice never share one.',
    Fields: AiProviderFields,
  },
};

export interface ProjectSettingsFormProps {
  projectId: string;
  project: ProjectVO;
  section: ProjectSettingsSection;
}

/**
 * Each settings sub-page edits one slice of the project, but submits the whole draft — the update
 * action re-validates every field, so a partial submit would drop values the user cannot see.
 */
export function ProjectSettingsForm({ projectId, project, section }: ProjectSettingsFormProps) {
  const router = useRouter();
  const updateProject = useUpdateProject(projectId);

  const [saved, setSaved] = useState<ProjectDraft>(() => draftFromProject(project));
  const [draft, setDraft] = useState<ProjectDraft>(saved);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [formError, setFormError] = useState<string | undefined>();

  const { title, description, Fields } = SECTIONS[section];
  const isDirty = JSON.stringify(draft) !== JSON.stringify(saved);

  function patch(next: Partial<ProjectDraft>) {
    setDraft((prev) => ({ ...prev, ...next }));
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setErrors({});
    setFormError(undefined);

    const result = await updateProject.mutateAsync(draftToInput(draft));
    if (result.errors) {
      setErrors(result.errors);
      return;
    }
    if (result.message) {
      setFormError(result.message);
      return;
    }

    setSaved(draft);
    toast.success(`${title} settings saved`);
    router.refresh();
  }

  function handleDiscard() {
    setDraft(saved);
    setErrors({});
    setFormError(undefined);
  }

  return (
    <form onSubmit={handleSubmit}>
      <SettingsPanel
        title={title}
        description={description}
        footer={
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p
              className="text-foreground-subtle flex items-center gap-1.5 text-xs"
              aria-live="polite"
            >
              {formError ? (
                <span className="text-destructive-text">{formError}</span>
              ) : isDirty ? (
                <>
                  <span className="bg-warning size-1.5 rounded-full" aria-hidden="true" />
                  Unsaved changes
                </>
              ) : (
                'All changes saved'
              )}
            </p>
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={handleDiscard}
                disabled={!isDirty || updateProject.isPending}
              >
                Discard
              </Button>
              <Button
                type="submit"
                size="sm"
                isLoading={updateProject.isPending}
                disabled={!isDirty || updateProject.isPending}
              >
                {updateProject.isPending ? 'Saving…' : 'Save changes'}
              </Button>
            </div>
          </div>
        }
      >
        <Fields value={draft} onChange={patch} errors={errors} />
      </SettingsPanel>
    </form>
  );
}
ProjectSettingsForm.displayName = 'ProjectSettingsForm';
