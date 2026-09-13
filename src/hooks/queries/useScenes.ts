'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
// Straight from `sonner`, not the `@/hooks` barrel — that barrel re-exports this very file.
import { toast } from 'sonner';

import { regenerateSceneAction, updateSceneAction } from '@/app/(protected)/projects/[id]/episodes/actions';
import type { SceneSpecPatch, SceneVO } from '@/types/value-objects';

async function scenesClient(episodeId: string): Promise<SceneVO[]> {
  const res = await fetch(`/api/episodes/${episodeId}/scenes`, { cache: 'no-store' });
  if (!res.ok) throw new Error('Failed to load scenes');
  return res.json() as Promise<SceneVO[]>;
}

/**
 * `isRunning` keeps the cards polling during a batch the rows can't yet report. A batch creates its
 * `Scene` rows as it goes, so before the first one lands there is no `GENERATING` scene to key off
 * and the grid would sit on "Not generated yet" for the whole run — the caller passes the SCENES
 * stage's own status instead.
 */
export function useScenes(episodeId: string, options: { enabled?: boolean; isRunning?: boolean } = {}) {
  return useQuery({
    queryKey: ['episode-scenes', episodeId],
    queryFn: () => scenesClient(episodeId),
    enabled: Boolean(episodeId) && (options.enabled ?? true),
    refetchInterval: (query) =>
      options.isRunning || query.state.data?.some((scene) => scene.status === 'GENERATING') ? 3000 : false,
  });
}

/**
 * The action returns the beat it wrote, so the common case costs no refetch at all: the row is
 * patched into the list in place. The two invalidations that remain are conditional — a beat's
 * status line only moves when SCRIPT's own status does (blank → first beat), and the forecast only
 * moves when a *priced* field does, which is duration and dialogue, never the description text.
 */
export function useUpdateScene(episodeId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ sceneIndex, patch }: { sceneIndex: number; patch: SceneSpecPatch }) =>
      updateSceneAction(episodeId, sceneIndex, patch),
    onSuccess: (result, { patch }) => {
      // No beat back means the write was refused — "this stage is generating right now", a lost
      // ownership check. That message used to be returned and dropped on the floor, so a refused
      // save looked exactly like a successful one and the edit appeared to vanish.
      if (!result.scene) {
        toast.error(result.message ?? 'Could not save this beat.');
        queryClient.invalidateQueries({ queryKey: ['episode-scenes', episodeId] });
        queryClient.invalidateQueries({ queryKey: ['episode-stages', episodeId] });
        return;
      }
      // Saved, but with something worth knowing — an unresolvable `@handle`, or a checkpoint that
      // could not be advanced.
      if (result.message) toast.warning(result.message);
      const saved = result.scene;
      queryClient.setQueryData<SceneVO[]>(['episode-scenes', episodeId], (scenes) =>
        scenes?.map((scene) => (scene.index === saved.index ? saved : scene)),
      );
      queryClient.invalidateQueries({ queryKey: ['episode-stages', episodeId] });
      // The forecast is priced off clip seconds and dialogue characters — and a beat's seconds are
      // its shot list, so editing the shots is what moves the estimate.
      if (patch.shots !== undefined || patch.dialogue !== undefined) {
        queryClient.invalidateQueries({ queryKey: ['episode-forecast', episodeId] });
      }
    },
  });
}

export function useRegenerateScene(episodeId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ sceneIndex, note }: { sceneIndex: number; note?: string }) =>
      regenerateSceneAction(episodeId, sceneIndex, note),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['episode-scenes', episodeId] });
      queryClient.invalidateQueries({ queryKey: ['episode-stages', episodeId] });
    },
  });
}
