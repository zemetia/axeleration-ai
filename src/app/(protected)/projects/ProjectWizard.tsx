'use client';

import { ArrowLeft, ArrowRight, Sparkles } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Stepper, type StepperStep } from '@/components/ui/Stepper';
import { useCreateProject } from '@/hooks/queries';

import { ProjectBasicsFields } from './ProjectBasicsFields';
import { ProjectPipelineFields } from './ProjectPipelineFields';
import { ProjectReview } from './ProjectReview';
import { ProjectStoryFields } from './ProjectStoryFields';
import { VideoConfigFields } from './VideoConfigFields';
import { EMPTY_DRAFT, draftToInput, type ProjectDraft } from './project-draft';

const STEPS: StepperStep[] = [
  { id: 'basics', label: 'Basics', description: 'Name, type, tags' },
  { id: 'story', label: 'Story', description: 'Premise and tone' },
  { id: 'video', label: 'Video', description: 'Format and pipeline' },
  { id: 'review', label: 'Review', description: 'Confirm and create' },
];

const STEP_TITLES = [
  'What are you making?',
  'What is the story?',
  'How should it look and run?',
  'Ready to create',
];

/** Which step owns each field, so a server-side error sends the user back to the right one. */
const FIELD_STEP: Record<string, number> = {
  name: 0,
  type: 0,
  tags: 0,
  logline: 0,
  premise: 1,
  targetAudience: 1,
  tone: 1,
  visualStyle: 1,
  language: 1,
  aspectRatio: 2,
  resolution: 2,
  targetTotalSeconds: 2,
  sceneDurationMin: 2,
  sceneDurationMax: 2,
  defaultResearchMode: 2,
};

/** Blocking checks per step — the server re-validates everything on submit. */
function validateStep(step: number, draft: ProjectDraft): Record<string, string[]> {
  if (step === 0 && !draft.name.trim()) return { name: ['Name is required'] };
  if (step === 1) {
    if (!draft.premise.trim()) return { premise: ['Premise is required'] };
    if (!draft.language.trim()) return { language: ['Language is required'] };
  }
  if (step === 2 && draft.sceneDurationMin > draft.sceneDurationMax) {
    return {
      sceneDurationMax: ['Minimum scene duration must be less than or equal to the maximum'],
    };
  }
  return {};
}

/** Multi-step create flow. Project settings reuse the same field groups, one section per page. */
export function ProjectWizard() {
  const router = useRouter();
  const createProject = useCreateProject();
  const [step, setStep] = useState(0);
  const [furthestStep, setFurthestStep] = useState(0);
  const [draft, setDraft] = useState<ProjectDraft>(EMPTY_DRAFT);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [formError, setFormError] = useState<string | undefined>();

  const isLastStep = step === STEPS.length - 1;

  function patch(next: Partial<ProjectDraft>) {
    setDraft((prev) => ({ ...prev, ...next }));
  }

  function goTo(next: number) {
    setErrors({});
    setStep(next);
    setFurthestStep((prev) => Math.max(prev, next));
  }

  function handleNext() {
    const stepErrors = validateStep(step, draft);
    if (Object.keys(stepErrors).length > 0) {
      setErrors(stepErrors);
      return;
    }
    goTo(step + 1);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!isLastStep) {
      handleNext();
      return;
    }

    setErrors({});
    setFormError(undefined);

    const result = await createProject.mutateAsync(draftToInput(draft));
    if (result.errors) {
      setErrors(result.errors);
      const firstStep = Math.min(
        ...Object.keys(result.errors).map((field) => FIELD_STEP[field] ?? 0),
      );
      setStep(firstStep);
      return;
    }
    if (result.message) {
      setFormError(result.message);
      return;
    }
    if (result.projectId) {
      router.push(`/projects/${result.projectId}`);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex w-full flex-col gap-6">
      <Stepper steps={STEPS} current={step} maxReachable={furthestStep} onStepChange={goTo} />

      <Card>
        <CardHeader>
          <CardTitle>{STEP_TITLES[step]}</CardTitle>
        </CardHeader>
        <CardContent className="pt-2">
          {step === 0 ? (
            <ProjectBasicsFields value={draft} onChange={patch} errors={errors} />
          ) : null}
          {step === 1 ? (
            <ProjectStoryFields value={draft} onChange={patch} errors={errors} />
          ) : null}
          {step === 2 ? (
            <div className="flex flex-col gap-8">
              <VideoConfigFields value={draft} onChange={patch} errors={errors} />
              <ProjectPipelineFields value={draft} onChange={patch} errors={errors} />
            </div>
          ) : null}
          {step === 3 ? <ProjectReview value={draft} /> : null}
        </CardContent>
      </Card>

      {formError ? <p className="text-destructive-text text-sm">{formError}</p> : null}

      <div className="flex items-center justify-between gap-3">
        <Button
          type="button"
          variant="ghost"
          disabled={step === 0 || createProject.isPending}
          onClick={() => goTo(step - 1)}
        >
          <ArrowLeft aria-hidden className="size-4" />
          Back
        </Button>

        <span className="text-foreground-subtle text-xs">
          Step {step + 1} of {STEPS.length}
        </span>

        {isLastStep ? (
          <Button type="submit" disabled={createProject.isPending}>
            <Sparkles aria-hidden className="size-4" />
            {createProject.isPending ? 'Creating…' : 'Create project'}
          </Button>
        ) : (
          <Button type="button" onClick={handleNext}>
            Continue
            <ArrowRight aria-hidden className="size-4" />
          </Button>
        )}
      </div>
    </form>
  );
}
ProjectWizard.displayName = 'ProjectWizard';
