import { assetDraftPrompt, assetDraftSchemaOf, assetFieldManifest } from '@/ai/prompts/asset-draft.prompt';
import { getChatModel } from '@/ai/router/model-router';
import { buildProjectBrief } from '@/ai/prompts/project-brief';
import { ASSET_TYPE_LABELS } from '@/config/asset-schema';
import { normalizeAssetAttributes, type AssetAttributes } from '@/lib/validations';
import { projectService } from '@/services';
import type { ProjectModelConfig } from '@/providers/types';
import type { AssetType } from '@prisma/client';

/**
 * The lab's one AI step: base prompt in, a filled-in asset out.
 *
 * Nothing here is authoritative — the draft lands in the form where the user reads and corrects it
 * before a single image is paid for. That is the whole reason drafting is separated from
 * generation: a wrong eye colour costs nothing to fix at this point and is baked into eight
 * renders one step later.
 */

export interface DraftAssetInput {
  projectId: string;
  type: AssetType;
  basePrompt: string;
  /** Present when re-drafting an already-filled form — the model refines instead of starting over. */
  existing?: { name?: string; description?: string; attributes?: AssetAttributes };
}

export interface DraftAssetResult {
  name: string;
  description: string;
  attributes: AssetAttributes;
}

function existingNote(existing: DraftAssetInput['existing']): string {
  const filled = Object.entries(existing?.attributes ?? {}).filter(([, value]) =>
    Array.isArray(value) ? value.length > 0 : Boolean(value),
  );
  if (!existing || (!existing.description && filled.length === 0)) {
    return 'Nothing has been filled in yet — draft the whole asset.';
  }
  return [
    'The user has already written the values below. Keep what they wrote, fix only what contradicts the brief, and fill in the gaps:',
    existing.name ? `name: ${existing.name}` : '',
    existing.description ? `description: ${existing.description}` : '',
    ...filled.map(([key, value]) => `${key}: ${Array.isArray(value) ? value.join(', ') : value}`),
  ]
    .filter(Boolean)
    .join('\n');
}

export async function runAssetDraftChain(input: DraftAssetInput): Promise<DraftAssetResult> {
  const project = await projectService.get(input.projectId);
  if (!project) throw new Error(`Project ${input.projectId} not found`);

  // `method: 'jsonMode'` — see `script.node.ts` for why bare `.withStructuredOutput()` 400s on
  // DeepSeek and most Sumopod-routed models ("response_format type is unavailable").
  const model = (
    await getChatModel('character-bible', {
      projectId: input.projectId,
      project: project.modelConfig as ProjectModelConfig | undefined,
    })
  ).withStructuredOutput(assetDraftSchemaOf(input.type), { method: 'jsonMode' });

  const draft = await assetDraftPrompt.pipe(model).invoke({
    typeLabel: ASSET_TYPE_LABELS[input.type],
    fieldManifest: assetFieldManifest(input.type),
    projectContext: buildProjectBrief({
      tags: project.tags,
      targetAudience: project.targetAudience,
      tone: project.tone,
      visualStyle: project.visualStyle,
      language: project.language,
    }),
    basePrompt: input.basePrompt,
    existingNote: existingNote(input.existing),
  });

  return {
    name: draft.name,
    description: draft.description,
    // Same normalization the save path uses — a model that invents a key gets it dropped here
    // rather than storing an attribute no form field will ever show.
    attributes: normalizeAssetAttributes(input.type, draft.attributes),
  };
}
