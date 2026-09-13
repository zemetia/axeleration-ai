'use client';

import { Anchor, FileText, FlaskConical, SlidersHorizontal, type LucideIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';

import { Badge } from '@/components/ui/Badge';
import { PageHeader } from '@/components/ui/PageHeader';
import { ASSET_TYPES, assetFieldsOf, assetSchemaOf } from '@/config/asset-schema';
import { planShotCounts } from '@/assets/lab/plan';
import { defaultViewIdsOf, hasVisualViews, viewPlanOf } from '@/config/asset-views';
import {
  useDraftAsset,
  useSetAssetStatus,
  useUploadLabReference,
  useUpsertAsset,
} from '@/hooks/queries';
import { cn } from '@/lib/cn';
import { forecastAssetShots } from '@/lib/cost-forecast';
import type { AssetAttributeValue, AssetAttributes } from '@/lib/validations';
import type { ProjectModelConfig } from '@/providers/types';
import type { AssetVO } from '@/types/value-objects';
import type { AssetType } from '@prisma/client';

import { LabBriefStep } from '../_lab/LabBriefStep';
import { LabSheetStep } from '../_lab/LabSheetStep';
import { LabViewsStep } from '../_lab/LabViewsStep';
import { useLabRun } from '../_lab/useLabRun';
import { accentOf } from '../asset-ui';
import { AssetDetailRail } from './AssetDetailRail';
import { AssetOverview } from './AssetOverview';

/**
 * The asset's own page.
 *
 * Three panes over one draft, not three routes: the loop this screen exists for is "read the sheet,
 * dislike an angle, fix a field, render it again", and a route change per pane would throw away the
 * in-flight lab run every time the user went back to correct an eye colour. Nothing here writes
 * until Save — a rendered shot is paid for the moment it renders, but it does not become part of
 * the asset until the draft is committed, which is why the dirty state lives in the rail where it
 * is visible from all three panes.
 */

export interface AssetDetailContentProps {
  projectId: string;
  projectName: string;
  asset: AssetVO;
  /** STYLE assets in this project, offered as a look to inherit. */
  styleAssets: AssetVO[];
  modelConfig?: ProjectModelConfig;
  /** Set when no credential resolves for the image capability — the render would fail late. */
  missingCredential?: string;
}

type PaneId = 'overview' | 'details' | 'lab';

const PANES: readonly { id: PaneId; label: string; icon: LucideIcon; hint: string }[] = [
  { id: 'overview', label: 'Overview', icon: FileText, hint: 'Everything this asset carries' },
  { id: 'details', label: 'Details', icon: SlidersHorizontal, hint: 'Edit its fields' },
  { id: 'lab', label: 'Lab', icon: FlaskConical, hint: 'Render its views' },
];

/** Empty values are dropped server-side, so they must not count as an edit either. */
function compactAttributes(attributes: AssetAttributes): AssetAttributes {
  const result: AssetAttributes = {};
  for (const key of Object.keys(attributes).sort()) {
    const value = attributes[key];
    if (Array.isArray(value)) {
      if (value.length > 0) result[key] = value;
    } else if (value?.trim()) {
      result[key] = value.trim();
    }
  }
  return result;
}

interface Draft {
  type: AssetType;
  name: string;
  description: string;
  voiceId: string;
  attributes: AssetAttributes;
  heroUrl: string | undefined;
  basePrompt: string;
  styleHandle: string;
  shotKeys: string[];
}

function signatureOf(draft: Draft): string {
  return JSON.stringify({
    ...draft,
    name: draft.name.trim(),
    description: draft.description.trim(),
    // A voice id is only sent for a VOICE asset, so a stale one must not read as an edit.
    voiceId: draft.type === 'VOICE' ? draft.voiceId.trim() : '',
    attributes: compactAttributes(draft.attributes),
    basePrompt: draft.basePrompt.trim(),
    heroUrl: draft.heroUrl ?? null,
    shotKeys: [...draft.shotKeys].sort(),
  });
}

export function AssetDetailContent({
  projectId,
  projectName,
  asset,
  styleAssets,
  modelConfig,
  missingCredential,
}: AssetDetailContentProps) {
  const router = useRouter();
  const draftAsset = useDraftAsset(projectId);
  const uploadReference = useUploadLabReference(projectId);
  const upsertAsset = useUpsertAsset(projectId);
  const setStatus = useSetAssetStatus(projectId);
  const labRun = useLabRun(projectId, asset.lab?.shots);

  const [pane, setPane] = useState<PaneId>('overview');
  const [type, setType] = useState<AssetType>(asset.type);
  const [name, setName] = useState(asset.name);
  const [description, setDescription] = useState(asset.description ?? '');
  const [voiceId, setVoiceId] = useState(asset.voiceId ?? '');
  const [attributes, setAttributes] = useState<AssetAttributes>(asset.attributes);
  const [basePrompt, setBasePrompt] = useState(asset.lab?.basePrompt ?? '');
  const [styleHandle, setStyleHandle] = useState(asset.lab?.styleHandle ?? '');
  const [heroUrl, setHeroUrl] = useState<string | undefined>(asset.refUrl ?? undefined);
  /** A file uploaded in this session — outranks the saved reference as the identity anchor. */
  const [uploadedUrl, setUploadedUrl] = useState<string | undefined>();
  const [selectedViewIds, setSelectedViewIds] = useState<string[]>(() => {
    const rendered = (asset.lab?.shots ?? []).map((shot) => shot.viewId);
    return rendered.length > 0 ? rendered : defaultViewIdsOf(asset.type);
  });
  /**
   * On by default when a reference exists: this asset already has an identity, and re-rendering an
   * angle from text instead of from that image is how a face drifts. Turning it off is the explicit
   * "give this asset a new look" gesture.
   */
  const [useSavedAnchor, setUseSavedAnchor] = useState(true);
  const [saveError, setSaveError] = useState<string | undefined>();

  const fields = assetFieldsOf(type);
  const filledFieldCount = Object.keys(compactAttributes(attributes)).filter((key) =>
    fields.some((field) => field.key === key),
  ).length;

  const anchorUrl = uploadedUrl ?? (useSavedAnchor && type !== 'VOICE' ? heroUrl : undefined);
  const completedShots = labRun.completedShots;

  const baseline = useMemo(
    () =>
      signatureOf({
        type: asset.type,
        name: asset.name,
        description: asset.description ?? '',
        voiceId: asset.voiceId ?? '',
        attributes: asset.attributes,
        heroUrl: asset.refUrl ?? undefined,
        basePrompt: asset.lab?.basePrompt ?? '',
        styleHandle: asset.lab?.styleHandle ?? '',
        shotKeys: (asset.lab?.shots ?? []).map((shot) => `${shot.viewId}:${shot.url}`),
      }),
    [asset],
  );
  const current = signatureOf({
    type,
    name,
    description,
    voiceId,
    attributes,
    heroUrl,
    basePrompt,
    styleHandle,
    shotKeys: completedShots.map((shot) => `${shot.viewId}:${shot.url}`),
  });
  const isDirty = current !== baseline;

  // One render from text, everything else image-to-image — and the anchor is a composed sheet, so
  // the count is panels, not views. See `planShotCounts`.
  const forecast = useMemo(() => {
    const plan = planShotCounts(type, selectedViewIds, Boolean(anchorUrl));
    return forecastAssetShots(plan.total, modelConfig, plan.fromReference);
  }, [type, selectedViewIds, anchorUrl, modelConfig]);

  function setAttribute(key: string, value: AssetAttributeValue) {
    setAttributes((currentAttributes) => ({ ...currentAttributes, [key]: value }));
  }

  function changeType(next: AssetType) {
    if (next === type) return;
    setType(next);
    // View ids are per type, and so is the field schema — a CHARACTER's "portrait" is not a MAP's
    // "full". Keeping either would leave the sheet describing an asset that no longer exists.
    setSelectedViewIds(defaultViewIdsOf(next));
    labRun.reset();
  }

  async function handleDraft() {
    const drafted = await draftAsset.mutateAsync({
      type,
      basePrompt,
      existing: { name: name || undefined, description: description || undefined, attributes },
    });
    setDescription(drafted.description);
    setAttributes(drafted.attributes);
  }

  async function handleUpload(file: File) {
    const { url } = await uploadReference.mutateAsync(file);
    setUploadedUrl(url);
    setHeroUrl(url);
  }

  const subject = {
    type,
    name: name || asset.name,
    description: description || undefined,
    attributes,
    basePrompt: basePrompt || undefined,
    styleHandle: styleHandle || undefined,
    referenceUrl: anchorUrl,
  };

  async function handleSave() {
    setSaveError(undefined);
    const formData = new FormData();
    formData.set('id', asset.id);
    formData.set('type', type);
    formData.set('handle', asset.handle);
    formData.set('name', name);
    formData.set('description', description);
    formData.set('voiceId', type === 'VOICE' ? voiceId : '');
    formData.set('attributes', JSON.stringify(attributes));
    // Always set, never conditional: an empty value is how the action is told the reference was
    // removed rather than left untouched.
    formData.set('refUrl', heroUrl ?? '');
    formData.set(
      'lab',
      JSON.stringify({
        basePrompt: basePrompt || undefined,
        styleHandle: styleHandle || undefined,
        shots: completedShots,
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
    // Re-renders the server component, so the Overview pane and the baseline both move to what was
    // just written instead of describing the row as it was when the page loaded.
    router.refresh();
  }

  function handleDiscard() {
    setSaveError(undefined);
    setType(asset.type);
    setName(asset.name);
    setDescription(asset.description ?? '');
    setVoiceId(asset.voiceId ?? '');
    setAttributes(asset.attributes);
    setBasePrompt(asset.lab?.basePrompt ?? '');
    setStyleHandle(asset.lab?.styleHandle ?? '');
    setHeroUrl(asset.refUrl ?? undefined);
    setUploadedUrl(undefined);
    labRun.reset(asset.lab?.shots);
    const rendered = (asset.lab?.shots ?? []).map((shot) => shot.viewId);
    setSelectedViewIds(rendered.length > 0 ? rendered : defaultViewIdsOf(asset.type));
  }

  const isArchived = asset.status === 'ARCHIVED';
  const accent = accentOf(type);
  const TypeIcon = accent.icon;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow={`${projectName} · ${assetSchemaOf(asset.type).label}`}
        title={asset.name}
        description={asset.description ?? assetSchemaOf(asset.type).tagline}
        meta={
          <>
            <Badge variant="soft" className="font-mono">
              @{asset.handle}
            </Badge>
            <Badge variant={isArchived ? 'secondary' : 'success'}>
              {isArchived ? 'Archived' : 'Active'}
            </Badge>
            {asset.refUrl ? null : <Badge variant="warning">No reference</Badge>}
          </>
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex min-w-0 flex-col gap-5">
          <div role="group" aria-label="Asset panes" className="border-border flex gap-1 border-b">
            {PANES.map((entry) => {
              const Icon = entry.icon;
              const isActive = entry.id === pane;
              return (
                <button
                  key={entry.id}
                  type="button"
                  aria-pressed={isActive}
                  title={entry.hint}
                  onClick={() => setPane(entry.id)}
                  className={cn(
                    'focus-visible:ring-ring -mb-px flex items-center gap-2 border-b-2 px-3 py-2 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none',
                    isActive
                      ? 'border-primary text-foreground'
                      : 'text-foreground-muted hover:text-foreground border-transparent',
                  )}
                >
                  <Icon aria-hidden className="size-4" />
                  {entry.label}
                </button>
              );
            })}
          </div>

          {isDirty && pane === 'overview' ? (
            <p className="border-warning/25 bg-warning-subtle text-warning-text rounded-lg border px-3 py-2 text-sm">
              This is the saved asset. You have unsaved changes in the other panes — save them and
              this view catches up.
            </p>
          ) : null}

          <div className="border-border bg-card elevation-sm rounded-2xl border p-6">
            {pane === 'overview' ? <AssetOverview asset={asset} styleAssets={styleAssets} /> : null}

            {pane === 'details' ? (
              <div className="flex flex-col gap-8">
                <section className="flex flex-col gap-3">
                  <div className="border-border flex flex-col gap-0.5 border-b pb-2">
                    <h3 className="text-foreground text-sm font-semibold">Type</h3>
                    <p className="text-foreground-muted text-xs">
                      Decides which details the asset asks for and which angles the lab renders.
                      Changing it re-files the details against the new type — anything that does not
                      exist there is dropped — and clears the rendered sheet.
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {ASSET_TYPES.map((option) => {
                      const optionAccent = accentOf(option);
                      const OptionIcon = optionAccent.icon;
                      const isActive = option === type;
                      return (
                        <button
                          key={option}
                          type="button"
                          aria-pressed={isActive}
                          onClick={() => changeType(option)}
                          className={cn(
                            'flex flex-col items-start gap-1.5 rounded-lg border p-3 text-left transition-colors',
                            'focus-visible:ring-ring focus-visible:ring-offset-background focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none',
                            isActive
                              ? cn(optionAccent.border, optionAccent.surface)
                              : 'border-border bg-surface hover:border-border-strong',
                          )}
                        >
                          <OptionIcon aria-hidden className={cn('size-4', optionAccent.text)} />
                          <span
                            className={cn(
                              'text-sm font-semibold',
                              isActive ? optionAccent.text : 'text-foreground',
                            )}
                          >
                            {assetSchemaOf(option).label}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                  {type !== asset.type ? (
                    <p className="border-warning/25 bg-warning-subtle text-warning-text rounded-lg border px-3 py-2 text-xs">
                      Saving re-files this asset from {assetSchemaOf(asset.type).label} to{' '}
                      {assetSchemaOf(type).label}. Fields the new type does not have are dropped, and
                      the {(asset.lab?.shots ?? []).length} rendered view
                      {(asset.lab?.shots ?? []).length === 1 ? '' : 's'} are replaced by whatever the
                      new plan renders.
                    </p>
                  ) : null}
                </section>

                <LabBriefStep
                  type={type}
                  basePrompt={basePrompt}
                  onBasePromptChange={setBasePrompt}
                  onDraft={() => void handleDraft()}
                  isDrafting={draftAsset.isPending}
                  draftError={draftAsset.error?.message}
                  name={name}
                  onNameChange={setName}
                  handle={asset.handle}
                  onHandleChange={() => undefined}
                  isHandleLocked
                  description={description}
                  onDescriptionChange={setDescription}
                  voiceId={voiceId}
                  onVoiceIdChange={setVoiceId}
                  attributes={attributes}
                  onAttributeChange={setAttribute}
                  referenceUrl={heroUrl}
                  onUpload={(file) => void handleUpload(file)}
                  onClearReference={() => {
                    setUploadedUrl(undefined);
                    setHeroUrl(undefined);
                  }}
                  isUploading={uploadReference.isPending}
                  uploadError={uploadReference.error?.message}
                />
              </div>
            ) : null}

            {pane === 'lab' ? (
              <div className="flex flex-col gap-8">
                <div
                  className={cn(
                    'flex items-start gap-3 rounded-xl border p-4',
                    accent.border,
                    accent.surface,
                  )}
                >
                  <TypeIcon aria-hidden className={cn('mt-0.5 size-4 shrink-0', accent.text)} />
                  <p className="text-foreground-muted text-sm leading-relaxed">
                    Views already rendered are kept — re-render only the angles you want to change,
                    and each one is billed as it runs. Nothing replaces this asset until you press
                    Save.
                  </p>
                </div>

                {hasVisualViews(type) && heroUrl ? (
                  <label className="border-border bg-surface flex cursor-pointer items-start gap-3 rounded-xl border p-4">
                    <input
                      type="checkbox"
                      checked={useSavedAnchor || Boolean(uploadedUrl)}
                      disabled={Boolean(uploadedUrl)}
                      onChange={(event) => setUseSavedAnchor(event.target.checked)}
                      className="accent-primary focus-visible:ring-ring mt-0.5 size-4 focus-visible:ring-2 focus-visible:outline-none"
                    />
                    <span className="flex flex-col gap-0.5">
                      <span className="text-foreground flex items-center gap-1.5 text-sm font-medium">
                        <Anchor aria-hidden className="size-3.5" />
                        Render from the current reference
                      </span>
                      <span className="text-foreground-muted text-xs leading-relaxed">
                        {uploadedUrl
                          ? 'The file you uploaded in Details is the anchor — every view renders from it.'
                          : 'Every selected view is rendered image-to-image from the reference image, so the asset keeps its identity. Turn this off to re-render the anchor from text and give it a new look.'}
                      </span>
                    </span>
                  </label>
                ) : null}

                <LabViewsStep
                  type={type}
                  selectedViewIds={selectedViewIds}
                  onToggleView={(viewId) =>
                    setSelectedViewIds((ids) =>
                      ids.includes(viewId) ? ids.filter((id) => id !== viewId) : [...ids, viewId],
                    )
                  }
                  onSelectAll={() => setSelectedViewIds(viewPlanOf(type).views.map((view) => view.id))}
                  onSelectNone={() => setSelectedViewIds([])}
                  styleHandle={styleHandle}
                  onStyleHandleChange={setStyleHandle}
                  styleAssets={styleAssets}
                  hasUploadedReference={Boolean(anchorUrl)}
                />

                <LabSheetStep
                  type={type}
                  selectedViewIds={selectedViewIds}
                  shots={labRun.shots}
                  isRunning={labRun.isRunning}
                  heroUrl={heroUrl}
                  hasUploadedReference={Boolean(anchorUrl)}
                  onRun={() => void labRun.run(subject, selectedViewIds)}
                  onRetry={(viewId) => void labRun.retry(subject, viewId)}
                  onSetHero={setHeroUrl}
                  canRun={selectedViewIds.length > 0}
                  blockedReason={
                    selectedViewIds.length === 0
                      ? 'Pick at least one angle above — that is what the lab renders.'
                      : undefined
                  }
                />
              </div>
            ) : null}
          </div>
        </div>

        <AssetDetailRail
          type={type}
          name={name}
          handle={asset.handle}
          heroUrl={heroUrl}
          isArchived={isArchived}
          filledFieldCount={filledFieldCount}
          totalFieldCount={fields.length}
          selectedViewCount={hasVisualViews(type) ? selectedViewIds.length : 0}
          renderedViewCount={completedShots.length}
          forecast={forecast}
          missingCredential={hasVisualViews(type) ? missingCredential : undefined}
          isDirty={isDirty}
          isSaving={upsertAsset.isPending}
          saveError={saveError}
          onSave={() => void handleSave()}
          onDiscard={handleDiscard}
          onToggleArchived={() =>
            setStatus.mutate(
              { assetId: asset.id, status: isArchived ? 'ACTIVE' : 'ARCHIVED' },
              { onSuccess: () => router.refresh() },
            )
          }
          isStatusPending={setStatus.isPending}
          updatedAt={asset.updatedAt}
        />
      </div>
    </div>
  );
}
AssetDetailContent.displayName = 'AssetDetailContent';
