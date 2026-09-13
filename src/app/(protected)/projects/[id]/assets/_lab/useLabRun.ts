'use client';

import { useCallback, useRef, useState } from 'react';

import { composeShotPrompt } from '@/assets/lab/compose';
import type { AssetShot } from '@/assets/lab/lab-record';
import { anchorViewOf, viewOf, type AssetView } from '@/config/asset-views';
import { useComposeSheet, useGenerateShot, type ShotVariables } from '@/hooks/queries';
import type { AssetType } from '@prisma/client';

/**
 * Runs a sheet.
 *
 * Two things make this more than a `Promise.all`. First, **the anchor goes first**: the identity
 * view is rendered from text, and every remaining view is then rendered image-to-image against it.
 * That ordering is the entire reason the eight angles look like one character rather than eight
 * cousins, so the rest of the batch waits for it — and if the anchor fails, nothing else is
 * started, because a sheet generated without it is money spent on a set that will not match.
 *
 * Second, **concurrency is capped**. Image providers rate-limit, and a failed shot has to be
 * retryable on its own; three at a time keeps the sheet filling visibly without turning one 429
 * into eight.
 */

const CONCURRENCY = 3;

export type ShotStatus = 'idle' | 'queued' | 'running' | 'done' | 'error';

export interface ShotState {
  status: ShotStatus;
  shot?: AssetShot;
  error?: string;
  /** Composed views only: which cell is rendering, so seven renders are not one silent spinner. */
  progress?: { done: number; total: number };
}

export type ShotStates = Record<string, ShotState>;

export interface LabSubject {
  type: AssetType;
  name: string;
  description?: string;
  attributes: ShotVariables['attributes'];
  basePrompt?: string;
  styleHandle?: string;
  /** Uploaded identity anchor. When present the anchor view is skipped as a reference source. */
  referenceUrl?: string;
}

/**
 * Shots already paid for — an asset's persisted sheet, replayed into the run's state so reopening
 * it in the lab shows the angles that exist instead of an empty sheet the user would re-buy.
 */
function seedFrom(shots: readonly AssetShot[] | undefined): ShotStates {
  return Object.fromEntries((shots ?? []).map((shot) => [shot.viewId, { status: 'done' as const, shot }]));
}

export function useLabRun(projectId: string, initialShots?: readonly AssetShot[]) {
  const generateShot = useGenerateShot(projectId);
  const composeSheet = useComposeSheet(projectId);
  const [shots, setShots] = useState<ShotStates>(() => seedFrom(initialShots));
  const [isRunning, setIsRunning] = useState(false);
  // Held in a ref as well as state: the anchor's URL is produced and consumed inside one `run`
  // call, where a state update has not landed yet.
  const anchorUrlRef = useRef<string | undefined>(undefined);
  /**
   * The single clean panel the identity was established on. Every other view is rendered against
   * *this*, never against the finished sheet: hand a seven-panel montage to image-to-image and the
   * model gives you a montage back.
   */
  const identityUrlRef = useRef<string | undefined>(undefined);

  const patch = useCallback((viewId: string, next: ShotState) => {
    setShots((current) => ({ ...current, [viewId]: next }));
  }, []);

  const generate = useCallback(
    async (subject: LabSubject, viewId: string, referenceUrl?: string) => {
      patch(viewId, { status: 'running' });
      try {
        const shot = await generateShot.mutateAsync({
          type: subject.type,
          name: subject.name,
          description: subject.description,
          attributes: subject.attributes,
          viewId,
          basePrompt: subject.basePrompt,
          styleHandle: subject.styleHandle,
          referenceUrl,
        });
        patch(viewId, { status: 'done', shot });
        return shot;
      } catch (error) {
        patch(viewId, { status: 'error', error: error instanceof Error ? error.message : 'Generation failed' });
        return null;
      }
    },
    [generateShot, patch],
  );

  /**
   * Renders a composed view: every panel as its own image, then one local montage.
   *
   * Panel one goes first and alone even here, for the same reason the anchor goes before the rest
   * of the sheet — the other six are rendered image-to-image against it, so the seven cells are one
   * character seen from seven angles rather than seven drawings of a description.
   */
  const generateSheet = useCallback(
    async (subject: LabSubject, view: AssetView, referenceUrl?: string): Promise<AssetShot | null> => {
      const panels = view.panels ?? [];
      const results: (AssetShot | undefined)[] = panels.map(() => undefined);
      let done = 0;

      const renderPanel = async (index: number, reference?: string) => {
        const panel = panels[index];
        if (!panel) return;
        const shot = await generateShot.mutateAsync({
          type: subject.type,
          name: subject.name,
          description: subject.description,
          attributes: subject.attributes,
          viewId: view.id,
          panelId: panel.id,
          basePrompt: subject.basePrompt,
          styleHandle: subject.styleHandle,
          referenceUrl: reference,
        });
        results[index] = shot;
        done += 1;
        patch(view.id, { status: 'running', progress: { done, total: panels.length } });
      };

      patch(view.id, { status: 'running', progress: { done: 0, total: panels.length } });

      try {
        await renderPanel(0, referenceUrl);
        const identity = referenceUrl ?? results[0]?.url;
        identityUrlRef.current = identity;

        const queue = panels.map((_, index) => index).slice(1);
        await Promise.all(
          Array.from({ length: Math.min(CONCURRENCY, queue.length) }, async () => {
            while (queue.length > 0) {
              const index = queue.shift();
              if (index === undefined) return;
              await renderPanel(index, identity);
            }
          }),
        );

        const rendered = panels.map((panel, index) => ({ panel, shot: results[index] }));
        const missing = rendered.find((entry) => !entry.shot);
        if (missing) throw new Error(`Panel "${missing.panel.label}" did not render`);

        const { url } = await composeSheet.mutateAsync({
          panels: rendered.flatMap((entry) =>
            entry.shot ? [{ url: entry.shot.url, kind: entry.panel.kind }] : [],
          ),
        });

        const first = results[0];
        const costs = results.flatMap((shot) => (typeof shot?.costUsd === 'number' ? [shot.costUsd] : []));
        const sheet: AssetShot = {
          viewId: view.id,
          label: view.label,
          url,
          // The sheet's own prompt, not the seven panel prompts: it is what the user copies to
          // rebuild this plate elsewhere, and what every panel was derived from.
          prompt: composeShotPrompt({
            type: subject.type,
            name: subject.name,
            description: subject.description,
            attributes: subject.attributes,
            view,
            basePrompt: subject.basePrompt,
          }).prompt,
          provider: first?.provider ?? 'composed',
          model: first?.model ?? 'panel montage',
          costUsd: costs.length > 0 ? Number(costs.reduce((sum, usd) => sum + usd, 0).toFixed(4)) : undefined,
          fromReference: Boolean(referenceUrl),
          createdAt: new Date().toISOString(),
        };
        patch(view.id, { status: 'done', shot: sheet });
        return sheet;
      } catch (error) {
        patch(view.id, {
          status: 'error',
          error: error instanceof Error ? error.message : 'Sheet generation failed',
        });
        return null;
      }
    },
    [composeSheet, generateShot, patch],
  );

  /** A composed view renders panel by panel; every other view is one call. */
  const generateView = useCallback(
    async (subject: LabSubject, view: AssetView, referenceUrl?: string) =>
      view.panels?.length ? generateSheet(subject, view, referenceUrl) : generate(subject, view.id, referenceUrl),
    [generate, generateSheet],
  );

  const run = useCallback(
    async (subject: LabSubject, viewIds: string[]) => {
      if (viewIds.length === 0) return;
      setIsRunning(true);
      // Merged, not replaced: re-rendering three angles of an existing sheet must not drop the
      // five that were already paid for, or saving afterwards would delete them.
      setShots((current) => ({
        ...current,
        ...Object.fromEntries(viewIds.map((id) => [id, { status: 'queued' as const }])),
      }));

      try {
        const anchor = anchorViewOf(subject.type);
        let reference = subject.referenceUrl;
        let remaining = viewIds;

        if (!reference && anchor && viewIds.includes(anchor.id)) {
          const shot = await generateView(subject, anchor);
          if (!shot) {
            // Anchor failed: leave the rest queued-but-untouched rather than spending on a set
            // that has nothing to stay consistent with.
            setShots((current) => {
              const next = { ...current };
              for (const id of viewIds) {
                // Only the ones this run queued — a view that already holds a shot keeps it.
                if (id !== anchor.id && next[id]?.status === 'queued') next[id] = { status: 'idle' };
              }
              return next;
            });
            return;
          }
          // A composed anchor hands over the panel it was built from, not the montage.
          reference = (anchor.panels?.length ? identityUrlRef.current : undefined) ?? shot.url;
          anchorUrlRef.current = reference;
          remaining = viewIds.filter((id) => id !== anchor.id);
        }

        const queue = [...remaining];
        const workers = Array.from({ length: Math.min(CONCURRENCY, queue.length) }, async () => {
          while (queue.length > 0) {
            const viewId = queue.shift();
            if (!viewId) return;
            await generate(subject, viewId, reference);
          }
        });
        await Promise.all(workers);
      } finally {
        setIsRunning(false);
      }
    },
    [generate, generateView],
  );

  /** Re-renders one angle. Uses the same reference the batch used, so a retry still matches the set. */
  const retry = useCallback(
    async (subject: LabSubject, viewId: string) => {
      setIsRunning(true);
      try {
        const view = viewOf(subject.type, viewId);
        if (!view) return;
        const anchor = anchorViewOf(subject.type);
        // Redoing the anchor itself must start from text (or the upload) — feeding it the previous
        // run's identity would launder a face the user is trying to replace.
        const reference =
          view.id === anchor?.id ? subject.referenceUrl : (subject.referenceUrl ?? anchorUrlRef.current);
        await generateView(subject, view, reference);
      } finally {
        setIsRunning(false);
      }
    },
    [generateView],
  );

  /** No argument clears the sheet (a type change); passing the persisted shots restores them (Discard). */
  const reset = useCallback((shots?: readonly AssetShot[]) => {
    setShots(seedFrom(shots));
    anchorUrlRef.current = undefined;
    identityUrlRef.current = undefined;
  }, []);

  const completed = Object.values(shots).filter((state) => state.status === 'done');

  return {
    shots,
    isRunning,
    run,
    retry,
    reset,
    completedShots: completed.flatMap((state) => (state.shot ? [state.shot] : [])),
    doneCount: completed.length,
  };
}
