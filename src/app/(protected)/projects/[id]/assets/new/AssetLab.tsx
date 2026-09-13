'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';

import { Button } from '@/components/ui/Button';
import { Stepper } from '@/components/ui/Stepper';
import { assetFieldsOf } from '@/config/asset-schema';
import { planShotCounts } from '@/assets/lab/plan';
import { defaultViewIdsOf, hasVisualViews, viewPlanOf } from '@/config/asset-views';
import { useUploadLabReference, useDraftAsset, useUpsertAsset } from '@/hooks/queries';
import { forecastAssetShots } from '@/lib/cost-forecast';
import type { AssetAttributeValue, AssetAttributes } from '@/lib/validations';
import type { ProjectModelConfig } from '@/providers/types';
import type { AssetVO } from '@/types/value-objects';
import type { AssetType } from '@prisma/client';

import { LabBriefStep } from '../_lab/LabBriefStep';
import { LabSheetStep } from '../_lab/LabSheetStep';
import { LabViewsStep } from '../_lab/LabViewsStep';
import { useLabRun } from '../_lab/useLabRun';
import { LabSummaryRail } from './LabSummaryRail';
import { LabTypeStep } from './LabTypeStep';

/**
 * The asset lab.
 *
 * Four steps, but not a wizard: the rail is always clickable, because the loop this screen is
 * actually for is "render the sheet, dislike an angle, go back and fix a field, render again". A
 * flow that made the user finish step 2 before returning to it would make that loop cost a page
 * reload. The summary rail stays visible from every step so the identity being built — and the
 * price of the next render — never leaves the screen.
 */

export interface AssetLabProps {
  projectId: string;
  /** STYLE assets in this project, offered as a look to inherit. */
  styleAssets: AssetVO[];
  modelConfig?: ProjectModelConfig;
  /** Set when no credential resolves for the image capability — the render would fail late. */
  missingCredential?: string;
}

const STEPS = [
  { id: 'type', label: 'Type', description: 'What kind of asset' },
  { id: 'brief', label: 'Brief', description: 'Prompt and details' },
  { id: 'views', label: 'View plan', description: 'Which angles' },
  { id: 'sheet', label: 'Lab', description: 'Render and pick' },
];

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

export function AssetLab({ projectId, styleAssets, modelConfig, missingCredential }: AssetLabProps) {
  const router = useRouter();
  const draftAsset = useDraftAsset(projectId);
  const uploadReference = useUploadLabReference(projectId);
  const upsertAsset = useUpsertAsset(projectId);
  const labRun = useLabRun(projectId);

  const [step, setStep] = useState(0);
  const [type, setType] = useState<AssetType>('CHARACTER');
  const [basePrompt, setBasePrompt] = useState('');
  const [name, setName] = useState('');
  const [handle, setHandle] = useState('');
  const [isHandleEdited, setIsHandleEdited] = useState(false);
  const [description, setDescription] = useState('');
  const [voiceId, setVoiceId] = useState('');
  const [attributes, setAttributes] = useState<AssetAttributes>({});
  const [styleHandle, setStyleHandle] = useState('');
  const [referenceUrl, setReferenceUrl] = useState<string | undefined>();
  const [heroUrl, setHeroUrl] = useState<string | undefined>();
  const [selectedViewIds, setSelectedViewIds] = useState<string[]>(() => defaultViewIdsOf('CHARACTER'));
  const [saveError, setSaveError] = useState<string | undefined>();

  const fields = assetFieldsOf(type);
  const filledFieldCount = fields.filter((field) => {
    const value = attributes[field.key];
    return Array.isArray(value) ? value.length > 0 : Boolean(value?.trim());
  }).length;

  // One render from text, everything else image-to-image — and the anchor is a composed sheet, so
  // the count is panels, not views. See `planShotCounts`.
  const forecast = useMemo(() => {
    const plan = planShotCounts(type, selectedViewIds, Boolean(referenceUrl));
    return forecastAssetShots(plan.total, modelConfig, plan.fromReference);
  }, [type, selectedViewIds, referenceUrl, modelConfig]);

  function changeType(next: AssetType) {
    setType(next);
    setSelectedViewIds(defaultViewIdsOf(next));
    // Attributes are per-type; a shot sheet is per-type as well. Keeping either would leave the
    // rail describing an asset that no longer exists.
    setAttributes({});
    labRun.reset();
    setHeroUrl(undefined);
    setStep(1);
  }

  function changeName(next: string) {
    setName(next);
    if (!isHandleEdited) setHandle(slugify(next));
  }

  function setAttribute(key: string, value: AssetAttributeValue) {
    setAttributes((current) => ({ ...current, [key]: value }));
  }

  async function handleDraft() {
    const draft = await draftAsset.mutateAsync({
      type,
      basePrompt,
      existing: { name: name || undefined, description: description || undefined, attributes },
    });
    if (!name) changeName(draft.name);
    setDescription(draft.description);
    setAttributes(draft.attributes);
  }

  async function handleUpload(file: File) {
    const { url } = await uploadReference.mutateAsync(file);
    setReferenceUrl(url);
    setHeroUrl(url);
  }

  const subject = {
    type,
    name: name || 'Untitled',
    description: description || undefined,
    attributes,
    basePrompt: basePrompt || undefined,
    styleHandle: styleHandle || undefined,
    referenceUrl,
  };

  async function handleRun() {
    await labRun.run(subject, selectedViewIds);
  }

  async function handleRetry(viewId: string) {
    await labRun.retry(subject, viewId);
  }

  async function handleSave() {
    setSaveError(undefined);
    const formData = new FormData();
    formData.set('type', type);
    formData.set('handle', handle);
    formData.set('name', name);
    formData.set('description', description);
    formData.set('voiceId', type === 'VOICE' ? voiceId : '');
    formData.set('attributes', JSON.stringify(attributes));
    // The uploaded reference is the fallback hero: an asset whose sheet was never rendered still
    // deserves the reference image the user gave it.
    const chosenRef = heroUrl ?? referenceUrl;
    if (chosenRef) formData.set('refUrl', chosenRef);
    formData.set(
      'lab',
      JSON.stringify({
        basePrompt: basePrompt || undefined,
        styleHandle: styleHandle || undefined,
        shots: labRun.completedShots,
      }),
    );

    const result = await upsertAsset.mutateAsync(formData);
    if (result.errors) {
      setSaveError(Object.values(result.errors)[0]?.[0]);
      return;
    }
    if (result.message) {
      setSaveError(result.message);
      return;
    }
    router.push(`/projects/${projectId}/assets`);
  }

  const canSave = name.trim().length > 0 && handle.trim().length > 0 && !labRun.isRunning;
  const canRun = name.trim().length > 0 && selectedViewIds.length > 0;

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="flex min-w-0 flex-col gap-6">
        <Stepper steps={STEPS} current={step} maxReachable={STEPS.length - 1} onStepChange={setStep} />

        <div className="border-border bg-card elevation-sm rounded-2xl border p-6">
          {step === 0 ? <LabTypeStep value={type} onChange={changeType} /> : null}

          {step === 1 ? (
            <LabBriefStep
              type={type}
              basePrompt={basePrompt}
              onBasePromptChange={setBasePrompt}
              onDraft={() => void handleDraft()}
              isDrafting={draftAsset.isPending}
              draftError={draftAsset.error?.message}
              name={name}
              onNameChange={changeName}
              handle={handle}
              onHandleChange={(next) => {
                setIsHandleEdited(true);
                setHandle(slugify(next));
              }}
              description={description}
              onDescriptionChange={setDescription}
              voiceId={voiceId}
              onVoiceIdChange={setVoiceId}
              attributes={attributes}
              onAttributeChange={setAttribute}
              referenceUrl={referenceUrl}
              onUpload={(file) => void handleUpload(file)}
              onClearReference={() => {
                setReferenceUrl(undefined);
                if (heroUrl === referenceUrl) setHeroUrl(undefined);
              }}
              isUploading={uploadReference.isPending}
              uploadError={uploadReference.error?.message}
            />
          ) : null}

          {step === 2 ? (
            <LabViewsStep
              type={type}
              selectedViewIds={selectedViewIds}
              onToggleView={(viewId) =>
                setSelectedViewIds((current) =>
                  current.includes(viewId) ? current.filter((id) => id !== viewId) : [...current, viewId],
                )
              }
              onSelectAll={() => setSelectedViewIds(viewPlanOf(type).views.map((view) => view.id))}
              onSelectNone={() => setSelectedViewIds([])}
              styleHandle={styleHandle}
              onStyleHandleChange={setStyleHandle}
              styleAssets={styleAssets}
              hasUploadedReference={Boolean(referenceUrl)}
            />
          ) : null}

          {step === 3 ? (
            <LabSheetStep
              type={type}
              selectedViewIds={selectedViewIds}
              shots={labRun.shots}
              isRunning={labRun.isRunning}
              heroUrl={heroUrl}
              hasUploadedReference={Boolean(referenceUrl)}
              onRun={() => void handleRun()}
              onRetry={(viewId) => void handleRetry(viewId)}
              onSetHero={setHeroUrl}
              canRun={canRun}
              blockedReason={
                name.trim().length === 0 ? 'Give the asset a name first — every prompt leads with it.' : undefined
              }
            />
          ) : null}
        </div>

        <div className="flex items-center justify-between gap-3">
          <Button
            type="button"
            variant="ghost"
            disabled={step === 0}
            onClick={() => setStep((current) => Math.max(0, current - 1))}
          >
            Back
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={step === STEPS.length - 1}
            onClick={() => setStep((current) => Math.min(STEPS.length - 1, current + 1))}
          >
            {step === 2 || !hasVisualViews(type) ? 'To the lab' : 'Next'}
          </Button>
        </div>
      </div>

      <LabSummaryRail
        type={type}
        name={name}
        handle={handle}
        heroUrl={heroUrl}
        filledFieldCount={filledFieldCount}
        totalFieldCount={fields.length}
        selectedViewCount={hasVisualViews(type) ? selectedViewIds.length : 0}
        doneCount={labRun.doneCount}
        forecast={forecast}
        missingCredential={hasVisualViews(type) ? missingCredential : undefined}
        onSave={() => void handleSave()}
        isSaving={upsertAsset.isPending}
        saveError={saveError}
        canSave={canSave}
      />
    </div>
  );
}
AssetLab.displayName = 'AssetLab';
