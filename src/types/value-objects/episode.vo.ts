import type { EpisodeStatus, ResearchMode, StageKind, StageStatus } from '@prisma/client';

export interface EpisodeStageVO {
  id: string;
  kind: StageKind;
  status: StageStatus;
  statusLabel: string;
  attempt: number;
  output: Record<string, unknown> | null;
  error: string | null;
  costEstimate: number | null;
  providerMeta: Record<string, unknown> | null;
  startedAt: string | null;
  finishedAt: string | null;
}

export interface EpisodeVO {
  id: string;
  projectId: string;
  number: number;
  title: string | null;
  status: EpisodeStatus;
  statusLabel: string;
  researchMode: ResearchMode;
  researchNotes: string | null;
  finalVideoUrl: string | null;
  totalCost: number | null;
  autoPilot: AutoPilotVO;
  createdAt: string;
  updatedAt: string;
}

/**
 * Auto-pilot as the UI needs to see it. `isRunning` is derived from the two timestamps rather than
 * stored, so it cannot disagree with them — see the schema comment on `Episode.autoPilotBudget`.
 */
export interface AutoPilotVO {
  isRunning: boolean;
  budgetUsd: number | null;
  startedAt: string | null;
  stoppedAt: string | null;
  /** Why the last run ended. Survives the run, so it is still readable afterwards. */
  stopReason: string | null;
}

export interface EpisodeWithStagesVO extends EpisodeVO {
  stages: EpisodeStageVO[];
}

export interface SceneDialogueLineVO {
  /** 1-based index of the shot the line is spoken over. */
  shot: number;
  speaker: string;
  /** How it is delivered — the "(whispered)" half of a dialogue line, not the words. */
  delivery: string;
  line: string;
}

export interface SceneShotVO {
  durationSeconds: number;
  camera: string;
  action: string;
}

/**
 * One scene card in the control room. Merges the SCRIPT stage's breakdown (which exists as soon as
 * the script is written) with the `Scene` row (which only exists once generation has been attempted)
 * — so the Scenes room can show editable cards *before* anything has been rendered. `id === null`
 * means "scripted but never generated".
 */
export interface SceneVO {
  id: string | null;
  episodeId: string;
  index: number;
  status: StageStatus;
  statusLabel: string;
  attempt: number;
  /** The block prompt's fields, in the order they render — see `formatScenePrompt`. */
  style: string;
  setting: string;
  shots: SceneShotVO[];
  lighting: string;
  audio: string;
  dialogue: SceneDialogueLineVO[];
  negative: string;
  /** Derived from `shots`, not stored separately — the clip's running time. */
  durationSeconds: number;
  prompt: string | null;
  videoUrl: string | null;
  error: string | null;
  costEstimate: number | null;
  /** Both null until the beat has been generated once — a scripted-only card has no `Scene` row. */
  startedAt: string | null;
  finishedAt: string | null;
}

/** Every field is optional and `undefined` means "leave it alone" — see `updateSceneSpec`. */
export interface SceneSpecPatch {
  style?: string;
  setting?: string;
  shots?: SceneShotVO[];
  lighting?: string;
  audio?: string;
  dialogue?: SceneDialogueLineVO[];
  negative?: string;
}

/**
 * Patches for the hand-written half of the pipeline. Inferred from the Zod schemas rather than
 * declared twice — the schema is what the Server Action validates against, so it is the shape.
 */
export type {
  ResearchDossierPatch,
  ResearchFindingInput,
  SceneSpecInput,
  ScriptPatch,
} from '@/lib/validations/episode';
