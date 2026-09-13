'use server';

import { requireAuth } from '@/lib/auth';
import { isLocalUrl, putObject } from '@/lib/storage';
import { assetSchema, assetUpdateSchema } from '@/lib/validations';
import { assetService, projectService } from '@/services';
import type { AssetStatus } from '@prisma/client';

export interface ActionResult {
  errors?: Record<string, string[]>;
  message?: string;
}

/**
 * Per-type attributes travel as one JSON blob rather than N form fields: the field set is
 * data-driven (`src/config/asset-schema.ts`), so flat FormData keys would have to be re-derived
 * from the type on the server anyway. A malformed blob degrades to "no attributes" — the service
 * normalizes against the type regardless.
 */
function readAttributes(formData: FormData): Record<string, unknown> | undefined {
  const raw = formData.get('attributes');
  if (typeof raw !== 'string' || raw.length === 0) return undefined;
  try {
    const parsed: unknown = JSON.parse(raw);
    return typeof parsed === 'object' && parsed !== null ? (parsed as Record<string, unknown>) : undefined;
  } catch {
    return undefined;
  }
}

function readJson(formData: FormData, key: string): unknown {
  const raw = formData.get(key);
  if (typeof raw !== 'string' || raw.length === 0) return undefined;
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}

/**
 * The lab's hero image is already in local storage (a provider wrote it there), so it arrives as a
 * URL rather than an upload. Only URLs this app produced are accepted — `keyFromUrl` throws on
 * anything else, which is what keeps a client from pointing an asset's reference at a foreign host
 * that every later provider call would then fetch.
 */
function readGeneratedRef(formData: FormData): string | undefined {
  const raw = formData.get('refUrl');
  if (typeof raw !== 'string' || raw.length === 0) return undefined;
  return isLocalUrl(raw) ? raw : undefined;
}

/**
 * Absent key means "leave it alone"; an empty string means the user removed it. `|| undefined`
 * collapses those two into one, which is why an emptied description used to save as a no-op.
 */
function readText(formData: FormData, key: string): string | undefined {
  const raw = formData.get(key);
  return typeof raw === 'string' ? raw : undefined;
}

function readAssetFields(formData: FormData) {
  return {
    type: formData.get('type'),
    handle: formData.get('handle'),
    name: formData.get('name'),
    description: readText(formData, 'description'),
    voiceId: readText(formData, 'voiceId'),
    metadata: readAttributes(formData),
    lab: readJson(formData, 'lab'),
  };
}

async function storeRefFile(projectId: string, handle: string, formData: FormData): Promise<string | undefined> {
  const file = formData.get('file');
  if (!(file instanceof File) || file.size === 0) return undefined;

  const buffer = Buffer.from(await file.arrayBuffer());
  const ext = file.name.includes('.') ? file.name.split('.').pop() : 'bin';
  // Cache-busting suffix: replacing a reference keeps the same handle, and both the browser and
  // any provider that fetched the old URL would otherwise serve the previous image.
  const key = `projects/${projectId}/assets/${handle}-${Date.now()}.${ext}`;
  const stored = await putObject(key, buffer);
  return stored.url;
}

async function assertOwner(projectId: string): Promise<boolean> {
  const session = await requireAuth();
  const ownerId = await projectService.ownerOf(projectId);
  return Boolean(ownerId) && ownerId === session.user.id;
}

export async function upsertAssetAction(projectId: string, formData: FormData): Promise<ActionResult> {
  if (!(await assertOwner(projectId))) return { message: 'Forbidden' };

  const assetId = formData.get('id');
  const fields = readAssetFields(formData);

  if (typeof assetId === 'string' && assetId.length > 0) {
    const parsed = assetUpdateSchema.safeParse({ ...fields, id: assetId });
    if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };

    const { id, ...input } = parsed.data;
    const uploaded = input.handle ? await storeRefFile(projectId, input.handle, formData) : undefined;
    const refUrl = uploaded ?? readGeneratedRef(formData);
    // An explicit empty `refUrl` is the detail page's "remove the reference" — distinct from the
    // key being absent, which every other caller means as "do not touch it".
    const clearsRef = !refUrl && formData.get('refUrl') === '';
    await assetService.update(id, {
      ...input,
      ...(refUrl ? { refUrl } : clearsRef ? { refUrl: null } : {}),
    });
    return {};
  }

  const parsed = assetSchema.safeParse(fields);
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };

  // An upload wins over a generated hero: the user picking a file is the more explicit act.
  const refUrl = (await storeRefFile(projectId, parsed.data.handle, formData)) ?? readGeneratedRef(formData);
  await assetService.create(projectId, { ...parsed.data, ...(refUrl ? { refUrl } : {}) });
  return {};
}

export async function setAssetStatusAction(
  projectId: string,
  assetId: string,
  status: AssetStatus,
): Promise<ActionResult> {
  if (!(await assertOwner(projectId))) return { message: 'Forbidden' };

  await assetService.setStatus(assetId, status);
  return {};
}
