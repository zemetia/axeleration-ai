import type { EpisodeStageVO } from '@/types/value-objects';
import type { StageKind } from '@prisma/client';

/**
 * The control room's four rooms. The pipeline is linear — 1 feeds 2 feeds 3 feeds 4 — but the rooms
 * are not a wizard: every room is always navigable, and going back to Idea after Scenes have
 * rendered is a normal move, not an escape hatch. `requires` only decides whether a room can *act*
 * yet, it never blocks navigation.
 */

export type RoomId = 'research' | 'idea' | 'scenes' | 'production';

export interface RoomDef {
  id: RoomId;
  label: string;
  blurb: string;
  stages: StageKind[];
  /** Upstream stage that must have produced output before this room can do anything. */
  requires: StageKind | null;
}

export const ROOMS: readonly RoomDef[] = [
  {
    id: 'research',
    label: 'Research',
    blurb: 'Ground the episode in sources before it is written',
    stages: ['RESEARCH'],
    requires: null,
  },
  {
    id: 'idea',
    label: 'Idea & Script',
    blurb: 'The idea itself, and the scene breakdown',
    // BREAKDOWN lives in this room for now — it is still the pass-through stub, so it has nothing of
    // its own to show. T17 gives it a panel, and possibly a room, once it produces the beats itself.
    stages: ['IDEA', 'SCRIPT', 'BREAKDOWN'],
    // Deliberately not gated on RESEARCH: an episode can be researched or not (`ResearchMode.SKIP`
    // is a real choice), so locking the idea behind a dossier would lock the whole pipeline for
    // every project that never wanted one.
    requires: null,
  },
  {
    id: 'scenes',
    label: 'Scenes',
    blurb: 'Generate and tune every shot, one card at a time',
    stages: ['SCENES'],
    // The beats now arrive from BREAKDOWN, so that is the stage this room waits on: gating on SCRIPT
    // would unlock the room while the breakdown it renders has not been produced.
    requires: 'BREAKDOWN',
  },
  {
    id: 'production',
    label: 'Production',
    blurb: 'Voice, music and the final render',
    stages: ['VOICE', 'MUSIC', 'RENDER'],
    requires: 'SCENES',
  },
] as const;

export const STAGE_LABELS: Record<StageKind, string> = {
  RESEARCH: 'Research',
  IDEA: 'Idea',
  SCRIPT: 'Script',
  BREAKDOWN: 'Breakdown',
  SCENES: 'Scenes',
  VOICE: 'Voice',
  MUSIC: 'Music',
  RENDER: 'Render',
};

/** What a stage is doing while it runs — shown next to the elapsed timer, not a bare "Generating…". */
export const STAGE_RUNNING_LABELS: Record<StageKind, string> = {
  RESEARCH: 'Researching the web',
  IDEA: 'Writing the idea',
  SCRIPT: 'Writing the scene breakdown',
  BREAKDOWN: 'Cutting the script into scenes',
  SCENES: 'Generating scene clips',
  MUSIC: 'Composing the music bed',
  VOICE: 'Synthesizing dialogue',
  RENDER: 'Stitching the final cut',
};

export const currencyFormat = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 3,
});

/**
 * Headline totals — an episode budget, a running spend. The three-decimal format above exists for
 * per-line prices where a stage really does cost $0.004; on a $16 total it just renders "$16.111",
 * which reads as false precision on a number the forecast itself calls order-of-magnitude.
 */
export const currencyTotalFormat = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** A stage counts as "produced something" once it is READY (reviewable) or APPROVED (accepted). */
export function hasOutput(stage: EpisodeStageVO | undefined): boolean {
  return stage?.status === 'READY' || stage?.status === 'APPROVED';
}

export type RoomStatus = 'locked' | 'idle' | 'working' | 'review' | 'done' | 'failed';

export interface RoomState extends RoomDef {
  status: RoomStatus;
  detail: string;
  /** False only while the upstream stage has produced nothing — the room still renders and is linkable. */
  isUnlocked: boolean;
}

const ROOM_STATUS_TONE: Record<RoomStatus, string> = {
  locked: 'text-foreground-subtle',
  idle: 'text-foreground-subtle',
  working: 'text-primary-text',
  review: 'text-warning-text',
  done: 'text-success',
  failed: 'text-destructive-text',
};

export function roomStatusTone(status: RoomStatus): string {
  return ROOM_STATUS_TONE[status];
}

export function buildRoomStates(stages: EpisodeStageVO[] | undefined): RoomState[] {
  const byKind = new Map((stages ?? []).map((stage) => [stage.kind, stage]));

  return ROOMS.map((room) => {
    const own = room.stages.map((kind) => byKind.get(kind)).filter((stage): stage is EpisodeStageVO => Boolean(stage));
    const gate = room.requires ? byKind.get(room.requires) : undefined;
    const isUnlocked = room.requires === null || hasOutput(gate);

    const approved = own.filter((stage) => stage.status === 'APPROVED').length;
    const failed = own.find((stage) => stage.status === 'FAILED');
    const working = own.find((stage) => stage.status === 'GENERATING');
    const review = own.find((stage) => stage.status === 'READY');

    const status: RoomStatus = failed
      ? 'failed'
      : working
        ? 'working'
        : own.length > 0 && approved === own.length
          ? 'done'
          : review
            ? 'review'
            : isUnlocked
              ? 'idle'
              : 'locked';

    const detail = failed
      ? `${STAGE_LABELS[failed.kind]} failed`
      : working
        ? `Generating ${STAGE_LABELS[working.kind].toLowerCase()}…`
        : status === 'done'
          ? 'All approved'
          : review
            ? `${STAGE_LABELS[review.kind]} waiting for you`
            : isUnlocked
              ? `${approved} of ${own.length} approved`
              : `Needs ${STAGE_LABELS[room.requires as StageKind].toLowerCase()} first`;

    return { ...room, status, detail, isUnlocked };
  });
}
