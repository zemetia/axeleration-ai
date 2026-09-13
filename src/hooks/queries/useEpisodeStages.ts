'use client';

import { useEffect } from 'react';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
// Straight from `sonner`, not the `@/hooks` barrel — that barrel re-exports this very file.
import { toast } from 'sonner';

import {
  addScriptSceneAction,
  approveStageAction,
  deleteScriptSceneAction,
  refineIdeaAction,
  refineScriptAction,
  regenerateStageAction,
  rerunResearchAction,
  updateScriptAction,
  writeIdeaAction,
} from '@/app/(protected)/projects/[id]/episodes/actions';
import type { ActionResult } from '@/app/(protected)/projects/[id]/episodes/actions';
import type { EpisodeStageVO, ResearchDossierPatch, SceneSpecInput, ScriptPatch } from '@/types/value-objects';
import type { StageKind } from '@prisma/client';

async function episodeStagesClient(episodeId: string): Promise<EpisodeStageVO[]> {
  const res = await fetch(`/api/episodes/${episodeId}/stages`, { cache: 'no-store' });
  if (!res.ok) throw new Error('Failed to load episode stages');
  return res.json() as Promise<EpisodeStageVO[]>;
}

/**
 * The RESEARCH stage's own endpoint (`/api/episodes/[id]/research`) — not a Server Action. Every
 * other write here goes through a Server Action, which posts to whatever page rendered its button;
 * for Research that page is the Idea room, which reads as Research and Idea sharing a request even
 * though they are unrelated stages. A real route makes the two independent regardless of which room
 * the button lives in. Business-rule failures still come back as 200 + `{ message }` (same
 * `ActionResult` shape every action returns) — only network/auth failures throw.
 */
async function episodeResearchClient(
  episodeId: string,
  init: { method: 'POST'; body: { query: string } } | { method: 'PATCH'; body: ResearchDossierPatch },
): Promise<ActionResult> {
  const res = await fetch(`/api/episodes/${episodeId}/research`, {
    method: init.method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(init.body),
  });
  if (!res.ok) throw new Error('Research request failed');
  return res.json() as Promise<ActionResult>;
}

/**
 * A regenerate/refine/rerun-research mutation only queues an Inngest event — it resolves as soon
 * as the event is *sent*, well before the function's guard step flips the row to GENERATING. The
 * naive `onSettled: invalidateQueries` used to race that webhook round-trip: the immediate refetch
 * almost always caught the *old* status, `refetchInterval` below saw no GENERATING row and turned
 * itself off, and — since `refetchOnWindowFocus`/`refetchOnReconnect` are both disabled
 * (`query-client.ts`) — polling never resumed. The DB was updated correctly; the client just never
 * asked again, so the idea text (or the error) appeared to "do nothing" until a hard reload.
 *
 * The fix: remember the stage's `attempt` at the moment we fire the mutation (the "floor"), and
 * keep polling — regardless of what the last-fetched `status` says — until either the stage goes
 * FAILED or its `attempt` climbs past the floor. That is the one fact that can't lie: the DB write
 * that ends a run always bumps `attempt`, so a floor comparison can't be fooled by a stale snapshot
 * the way a status check can.
 */
type PendingFloor = Partial<Record<StageKind, number>>;

function pendingFloorKey(episodeId: string) {
  return ['episode-stages-pending-floor', episodeId] as const;
}

function markPending(
  queryClient: ReturnType<typeof useQueryClient>,
  episodeId: string,
  kind: StageKind,
  attemptFloor: number,
) {
  queryClient.setQueryData<PendingFloor>(pendingFloorKey(episodeId), (prev) => ({
    ...prev,
    [kind]: attemptFloor,
  }));
  // Optimistically flip the row to GENERATING so polling starts on this tick instead of waiting
  // for the next fetch to (maybe) observe it — belt-and-suspenders alongside the floor above.
  queryClient.setQueryData<EpisodeStageVO[]>(['episode-stages', episodeId], (prev) =>
    prev?.map((stage) => (stage.kind === kind ? { ...stage, status: 'GENERATING' } : stage)),
  );
}

export function useEpisodeStages(episodeId: string) {
  const queryClient = useQueryClient();
  return useQuery({
    queryKey: ['episode-stages', episodeId],
    queryFn: () => episodeStagesClient(episodeId),
    enabled: Boolean(episodeId),
    // 2s while a stage is running (was 3s) — catches status transitions (GENERATING → READY/FAILED)
    // promptly. The live "what's happening right now" line is separate: see `useStageActivity`, which
    // streams over SSE instead of polling.
    refetchInterval: (query) => {
      const data = query.state.data;
      if (data?.some((stage) => stage.status === 'GENERATING')) return 2000;

      const floor = queryClient.getQueryData<PendingFloor>(pendingFloorKey(episodeId));
      const stillAwaitingResult = data?.some((stage) => {
        const attemptFloor = floor?.[stage.kind];
        return attemptFloor !== undefined && stage.status !== 'FAILED' && stage.attempt <= attemptFloor;
      });
      return stillAwaitingResult ? 1000 : false;
    },
  });
}

export function useApproveStage(episodeId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (stage: StageKind) => approveStageAction(episodeId, stage),
    // Approve is where a deferred checkpoint alignment surfaces: the action waits for any pending
    // one before queueing the event, and reports it here rather than dropping it on the floor.
    onSuccess: (result) => {
      if (result.message) toast.warning(result.message);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['episode-stages', episodeId] });
      // Approving SCRIPT starts the scene batch, which writes `Scene` rows the cards read.
      queryClient.invalidateQueries({ queryKey: ['episode-scenes', episodeId] });
    },
  });
}

export function useRegenerateStage(episodeId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ stage, note, scope }: { stage: StageKind; note?: string; scope?: 'missing' | 'all' }) =>
      regenerateStageAction(episodeId, stage, note, scope),
    onMutate: ({ stage }) => markStagePending(queryClient, episodeId, stage),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['episode-stages', episodeId] });
      // A SCENES run writes `Scene` rows, and the cards poll off this key — without it a
      // "Generate remaining" run leaves every untouched card reading "Not generated yet".
      queryClient.invalidateQueries({ queryKey: ['episode-scenes', episodeId] });
    },
  });
}

/*
 * Refine and Re-research invalidate `episode-forecast` alongside the stage list, which Regenerate
 * does not need to: both bump `attempt`, and the room reads the remaining attempts off the same
 * payload that carries the prices. Re-research also rewrites the RESEARCH row, so its stage card
 * has to re-read too — that is covered by the shared `episode-stages` key.
 */
function invalidateIdea(queryClient: ReturnType<typeof useQueryClient>, episodeId: string) {
  queryClient.invalidateQueries({ queryKey: ['episode-stages', episodeId] });
  queryClient.invalidateQueries({ queryKey: ['episode-forecast', episodeId] });
}

function markStagePending(
  queryClient: ReturnType<typeof useQueryClient>,
  episodeId: string,
  kind: StageKind,
) {
  const current = queryClient.getQueryData<EpisodeStageVO[]>(['episode-stages', episodeId]);
  const attempt = current?.find((row) => row.kind === kind)?.attempt ?? 0;
  markPending(queryClient, episodeId, kind, attempt);
}

export function useRefineIdea(episodeId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (note?: string) => refineIdeaAction(episodeId, note),
    onMutate: () => markStagePending(queryClient, episodeId, 'IDEA'),
    onSettled: () => invalidateIdea(queryClient, episodeId),
  });
}

export function useRerunResearch(episodeId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (note?: string) => rerunResearchAction(episodeId, note),
    onMutate: () => markStagePending(queryClient, episodeId, 'RESEARCH'),
    onSettled: () => invalidateIdea(queryClient, episodeId),
  });
}

/** Searches for whatever the user typed and appends it to the dossier — see `/api/episodes/[id]/research`. */
export function useRunAdditionalResearch(episodeId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (query: string) =>
      episodeResearchClient(episodeId, { method: 'POST', body: { query } }),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['episode-stages', episodeId] }),
  });
}

export function useUpdateResearchDossier(episodeId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (patch: ResearchDossierPatch) =>
      episodeResearchClient(episodeId, { method: 'PATCH', body: patch }),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['episode-stages', episodeId] }),
  });
}

export function useWriteIdea(episodeId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (text: string) => writeIdeaAction(episodeId, text),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['episode-stages', episodeId] }),
  });
}

/*
 * The three SCRIPT writers also invalidate `episode-scenes`: the Scenes room derives its cards from
 * the SCRIPT stage's output, so a logline edit is stage-only but an added or removed beat changes
 * both views. Same pairing `useUpdateScene` already uses. `episode-forecast` rides along because
 * every price on the page is derived from the beat list — a new beat makes the batch cost more.
 */
function invalidateScript(queryClient: ReturnType<typeof useQueryClient>, episodeId: string) {
  queryClient.invalidateQueries({ queryKey: ['episode-stages', episodeId] });
  queryClient.invalidateQueries({ queryKey: ['episode-scenes', episodeId] });
  queryClient.invalidateQueries({ queryKey: ['episode-forecast', episodeId] });
}

/**
 * Refine bumps `attempt` on SCRIPT like Regenerate does, so it invalidates the same keys — the
 * beat list, the video cards derived from it, and the forecast the remaining-attempts count reads.
 */
export function useRefineScript(episodeId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (note?: string) => refineScriptAction(episodeId, note),
    onMutate: () => markStagePending(queryClient, episodeId, 'SCRIPT'),
    onSettled: () => invalidateScript(queryClient, episodeId),
  });
}

export function useUpdateScript(episodeId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (patch: ScriptPatch) => updateScriptAction(episodeId, patch),
    onSettled: () => invalidateScript(queryClient, episodeId),
  });
}

export function useAddScriptScene(episodeId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: SceneSpecInput) => addScriptSceneAction(episodeId, input),
    onSettled: () => invalidateScript(queryClient, episodeId),
  });
}

export function useDeleteScriptScene(episodeId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (sceneIndex: number) => deleteScriptSceneAction(episodeId, sceneIndex),
    onSettled: () => invalidateScript(queryClient, episodeId),
  });
}

type StageActivity = Partial<Record<StageKind, string | null>>;

function stageActivityKey(episodeId: string) {
  return ['episode-stage-activity', episodeId] as const;
}

/**
 * One `EventSource` per episode, shared by every component that reads its activity.
 *
 * This registry is the whole point of the module-level state. The subscription used to live in a
 * plain `useEffect` inside `useStageActivity`, which opened a connection *per component instance* —
 * and the Idea room alone mounts four readers of the same episode (`RunningBanner`, plus a
 * `StagePanel` each for Research, Idea and Script). An SSE response holds its socket for the life
 * of the page, and a browser gives an HTTP/1.1 origin six of them; four never-closing streams left
 * two sockets for polling, RSC prefetches and every Server Action combined. "Save beat" then sat in
 * the browser's socket queue instead of reaching a server that answers in ~20ms — the request never
 * left Chrome, so the button span forever. Ref-counting collapses the four back into one.
 */
const activityStreams = new Map<string, { source: EventSource; refs: number }>();

function openActivityStream(
  episodeId: string,
  queryClient: ReturnType<typeof useQueryClient>,
): () => void {
  let entry = activityStreams.get(episodeId);
  if (!entry) {
    const source = new EventSource(`/api/episodes/${episodeId}/activity`);
    source.onmessage = (event) => {
      const parsed = JSON.parse(event.data) as { kind: StageKind; activity: string | null };
      queryClient.setQueryData<StageActivity>(stageActivityKey(episodeId), (prev) => ({
        ...prev,
        [parsed.kind]: parsed.activity,
      }));
    };
    entry = { source, refs: 0 };
    activityStreams.set(episodeId, entry);
  }
  entry.refs += 1;

  return () => {
    const open = activityStreams.get(episodeId);
    // Identity check, not just presence: a StrictMode remount can close and reopen the stream
    // between this subscriber's mount and its cleanup, and the replacement is not ours to close.
    if (!open || open !== entry) return;
    open.refs -= 1;
    if (open.refs > 0) return;
    open.source.close();
    activityStreams.delete(episodeId);
  };
}

/**
 * A stage's live "what's happening right now" line, pushed over SSE from
 * `/api/episodes/[id]/activity` instead of polled or persisted (see `src/lib/activity-bus.ts`). The
 * subscription writes into the Query cache via `setQueryData` rather than `useState` — this is
 * server-sourced data like any other, so it goes through the same cache every other read here uses,
 * and every component reading this hook for the same episode shares one cache entry *and*, via
 * `openActivityStream`, one connection.
 */
export function useStageActivity(episodeId: string): StageActivity {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!episodeId) return;
    return openActivityStream(episodeId, queryClient);
  }, [episodeId, queryClient]);

  const { data } = useQuery({
    queryKey: stageActivityKey(episodeId),
    queryFn: (): StageActivity => ({}),
    enabled: Boolean(episodeId),
    staleTime: Infinity,
    gcTime: Infinity,
  });

  return data ?? {};
}
