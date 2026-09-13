import { panelOf, viewOf, type ShotAspect } from '@/config/asset-views';
import { aiConfig } from '@/config/ai';
import { buildAssetProfile } from '@/assets/profile';
import type { AssetAttributes } from '@/lib/validations';
import { registerProviders } from '@/providers/register';
import { providerRegistry } from '@/providers/registry';
import type { AssetRef, ProjectModelConfig } from '@/providers/types';
import { apiKeyService, assetService, projectService } from '@/services';
import type { AssetType } from '@prisma/client';

import { composeShotPrompt } from './compose';
import type { AssetShot } from './lab-record';

/**
 * Renders one view of one asset.
 *
 * One shot per call, on purpose. A turnaround is eight images against a provider that takes ~20s
 * each; generating them in a single request would be a three-minute POST that fails as a unit and
 * shows nothing until it is done. The client fans these out a few at a time instead, so the sheet
 * fills in progressively and a single bad angle is retried on its own rather than re-paying for the
 * seven that worked.
 */

export interface GenerateShotInput {
  projectId: string;
  type: AssetType;
  name: string;
  description?: string;
  attributes: AssetAttributes;
  viewId: string;
  /** One cell of a composed view. The caller renders each in turn and tiles them afterwards. */
  panelId?: string;
  basePrompt?: string;
  /** Handle of a STYLE asset in this project — its profile is folded into every shot. */
  styleHandle?: string;
  /**
   * Identity anchor: the uploaded reference, or the locked anchor shot. Present means this render
   * goes through image-to-image, which is what actually keeps a face the same face across angles.
   */
  referenceUrl?: string;
}

function priceOf(provider: string, model: string, count = 1): number | undefined {
  const entry = aiConfig.costTable[provider]?.[model];
  return entry ? Number((entry.usd * count).toFixed(4)) : undefined;
}

export async function generateAssetShot(input: GenerateShotInput): Promise<AssetShot> {
  const view = viewOf(input.type, input.viewId);
  if (!view) throw new Error(`Unknown view "${input.viewId}" for asset type ${input.type}`);

  const panel = input.panelId ? panelOf(view, input.panelId) : undefined;
  if (input.panelId && !panel) {
    throw new Error(`Unknown panel "${input.panelId}" for view ${input.type}/${view.id}`);
  }
  // A body panel is a standing figure and a face panel is a head — rendering either into the
  // sheet's own square would crop the first and waste half the pixels on the second.
  const aspect: ShotAspect = panel ? (panel.kind === 'body' ? '9:16' : '1:1') : view.aspect;

  const [project, styleAsset] = await Promise.all([
    projectService.get(input.projectId),
    input.styleHandle ? assetService.get(input.projectId, input.styleHandle) : Promise.resolve(null),
  ]);
  if (!project) throw new Error(`Project ${input.projectId} not found`);

  const { prompt, negativePrompt } = composeShotPrompt({
    type: input.type,
    name: input.name,
    description: input.description,
    attributes: input.attributes,
    view,
    panel,
    basePrompt: input.basePrompt,
    styleText: styleAsset ? buildAssetProfile(styleAsset) : undefined,
  });

  // The registry is not bootstrapped globally — every entry point that reaches it registers the
  // adapters itself (idempotent). See LEARN, 2026-07-29.
  registerProviders();

  const referenceImages: AssetRef[] = input.referenceUrl
    ? [{ handle: 'reference', type: input.type, refUrl: input.referenceUrl }]
    : [];
  const capability = referenceImages.length > 0 ? 'image-to-image' : 'text-to-image';
  const modelConfig = project.modelConfig as ProjectModelConfig | undefined;

  const result = await providerRegistry.run(
    capability,
    { capability, prompt, negativePrompt, referenceImages, aspectRatio: aspect },
    {
      project: modelConfig,
      resolveApiKey: (provider, apiKeyId) =>
        apiKeyService.getDecrypted(input.projectId, provider, apiKeyId).then((key) => key ?? ''),
    },
  );

  const output = result.outputs.find((entry) => entry.kind === 'image') ?? result.outputs[0];
  if (!output) throw new Error(`View "${view.label}": provider returned no image`);

  const { provider, model } = result.providerMeta;
  return {
    // Panel shots are intermediates — the client tiles them and persists the sheet, not these —
    // but they are namespaced anyway so one can never be mistaken for the view's own shot.
    viewId: panel ? `${view.id}#${panel.id}` : view.id,
    label: panel ? `${view.label} · ${panel.label}` : view.label,
    url: output.url,
    prompt,
    provider,
    model,
    costUsd: result.costEstimate ?? priceOf(provider, model),
    fromReference: referenceImages.length > 0,
    createdAt: new Date().toISOString(),
  };
}
