'use client';

import { useMutation } from '@tanstack/react-query';

import type { AssetShot } from '@/assets/lab/lab-record';
import type { AssetAttributes } from '@/lib/validations';
import type { AssetType } from '@prisma/client';

/**
 * The asset lab's three calls. All POST route handlers rather than Server Actions: shots are fired
 * several at a time and actions run one-in-flight per client, so the same sheet through actions
 * would render strictly one image after another.
 */

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const payload = (await res.json().catch(() => null)) as { message?: string } | null;
    throw new Error(payload?.message ?? `Request failed with ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export interface AssetDraftResult {
  name: string;
  description: string;
  attributes: AssetAttributes;
}

export interface DraftVariables {
  type: AssetType;
  basePrompt: string;
  existing?: { name?: string; description?: string; attributes?: AssetAttributes };
}

export function useDraftAsset(projectId: string) {
  return useMutation({
    mutationFn: (variables: DraftVariables) =>
      postJson<AssetDraftResult>(`/api/projects/${projectId}/assets/lab/draft`, variables),
  });
}

export interface ShotVariables {
  type: AssetType;
  name: string;
  description?: string;
  attributes: AssetAttributes;
  viewId: string;
  /** One cell of a composed view — see `AssetView.panels`. */
  panelId?: string;
  basePrompt?: string;
  styleHandle?: string;
  referenceUrl?: string;
}

/** One view per call — the sheet's fan-out and its per-angle retry are both this mutation. */
export function useGenerateShot(projectId: string) {
  return useMutation({
    mutationFn: (variables: ShotVariables) =>
      postJson<AssetShot>(`/api/projects/${projectId}/assets/lab/shot`, variables),
  });
}

export interface SheetVariables {
  panels: { url: string; kind: 'body' | 'face' }[];
}

/** Local montage of panels already rendered — no provider call, so no cost and no retry logic. */
export function useComposeSheet(projectId: string) {
  return useMutation({
    mutationFn: (variables: SheetVariables) =>
      postJson<{ url: string }>(`/api/projects/${projectId}/assets/lab/sheet`, variables),
  });
}

export function useUploadLabReference(projectId: string) {
  return useMutation({
    mutationFn: async (file: File) => {
      const body = new FormData();
      body.set('file', file);
      const res = await fetch(`/api/projects/${projectId}/assets/lab/reference`, {
        method: 'POST',
        credentials: 'same-origin',
        body,
      });
      if (!res.ok) {
        const payload = (await res.json().catch(() => null)) as { message?: string } | null;
        throw new Error(payload?.message ?? `Upload failed with ${res.status}`);
      }
      return res.json() as Promise<{ url: string }>;
    },
  });
}
