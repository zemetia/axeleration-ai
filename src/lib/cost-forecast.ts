import { aiConfig } from '@/config/ai';
import { STAGE_ORDER } from '@/config/pipeline';
import type { ProjectModelConfig } from '@/providers/types';
import type { ResearchMode, StageKind } from '@prisma/client';

/**
 * What a stage will cost and how long it will take *before* it is run.
 *
 * `EpisodeStage.costEstimate` is written after the fact by the nodes, which is too late to be a
 * decision: Approve starts spending immediately and the number only appears once the money is gone.
 * This module answers the same question up front from the same `aiConfig.costTable` the bill is
 * derived from, so the confirm dialog can show a price.
 *
 * Deliberately pure and dependency-free — no provider registry, no adapters, no SDK. `select()`
 * would drag every provider adapter into whatever imports this, and all the forecast actually needs
 * is the same precedence rule (project override → `aiConfig.defaults`) applied to a price table.
 * Accuracy is order-of-magnitude: enough to tell a $0.02 stage from a $12 one, never a quote.
 */

type CapabilityKey = keyof typeof aiConfig.defaults;

export interface ForecastLine {
  label: string;
  provider: string;
  model: string;
  /** Number of billable units — seconds, images, calls, or thousands of characters. */
  units: number;
  unit: 'second' | 'image' | 'call' | '1kchars';
  /** `null` when the resolved model has no entry in the cost table. */
  usd: number | null;
}

export interface StageForecast {
  lines: ForecastLine[];
  /** Sum of the priced lines. Still a number when some lines are unpriced — see `hasUnpricedModel`. */
  totalUsd: number;
  /** True when at least one resolved model is missing from `aiConfig.costTable`, so the total is a floor. */
  hasUnpricedModel: boolean;
  /** Rough wall-clock estimate in seconds. Coarse constants, not measured history. */
  etaSeconds: number;
  /** Free stages (local ffmpeg) and stages with nothing to do report no lines. */
  isFree: boolean;
}

/** Everything the forecast needs about an episode, gathered by the caller (server-side). */
export interface ForecastInput {
  modelConfig: ProjectModelConfig | undefined;
  researchMode: ResearchMode;
  /** Beats currently in the SCRIPT breakdown. */
  sceneCount: number;
  /** Sum of every beat's `durationSeconds`. */
  totalSceneSeconds: number;
  /** Characters of spoken dialogue across every beat — what TTS is billed on. */
  dialogueChars: number;
  /** Premise + style + research summary + idea: the prompt context every LLM stage carries. */
  briefChars: number;
}

/**
 * Characters each LLM stage *writes*. Input size is `briefChars` plus these, because the cost table
 * prices a single blended `1kchars` rate rather than separate in/out rates.
 */
const LLM_OUTPUT_CHARS: Record<'RESEARCH' | 'IDEA' | 'SCRIPT' | 'VOICE' | 'MUSIC', number> = {
  RESEARCH: 6000,
  IDEA: 2500,
  SCRIPT: 6000,
  VOICE: 800,
  MUSIC: 400,
};

/** Prompt the scene composer writes per beat, on top of the brief. */
const SCENE_COMPOSE_CHARS = 900;

/** Coarse wall-clock constants, in seconds. */
const ETA = {
  llmCall: 25,
  /** One search round trip in the ReAct loop — a fetch plus the model's next turn. */
  researchSearch: 14,
  /** A text-to-video call, whatever its clip length. */
  videoCall: 90,
  ttsPer1kChars: 9,
  musicCall: 45,
  renderBase: 60,
  renderPerScene: 8,
} as const;

/** Same precedence as `providerRegistry.select()`, minus the adapter lookup: project override wins. */
export function resolveModel(
  capability: CapabilityKey,
  modelConfig: ProjectModelConfig | undefined,
): { provider: string; model: string } {
  const target = modelConfig?.[capability] ?? aiConfig.defaults[capability];
  return { provider: target.provider, model: target.model };
}

function priceOf(provider: string, model: string): { per: ForecastLine['unit']; usd: number } | null {
  return aiConfig.costTable[provider]?.[model] ?? null;
}

function line(
  label: string,
  capability: CapabilityKey,
  units: number,
  modelConfig: ProjectModelConfig | undefined,
): ForecastLine {
  const { provider, model } = resolveModel(capability, modelConfig);
  const price = priceOf(provider, model);
  return {
    label,
    provider,
    model,
    units,
    unit: price?.per ?? 'call',
    usd: price ? Number((price.usd * units).toFixed(4)) : null,
  };
}

function collect(lines: ForecastLine[], etaSeconds: number): StageForecast {
  const priced = lines.filter((entry) => entry.usd !== null);
  return {
    lines,
    totalUsd: Number(priced.reduce((sum, entry) => sum + (entry.usd ?? 0), 0).toFixed(4)),
    hasUnpricedModel: priced.length !== lines.length,
    etaSeconds,
    isFree: lines.length === 0,
  };
}

/**
 * One quote for an action that runs several stages back to back — Re-research is RESEARCH followed
 * by IDEA, and the user commits to both with one click, so they must see one number.
 *
 * Recombining through `collect` rather than adding the totals keeps `hasUnpricedModel` honest: an
 * unpriced line anywhere in the sequence makes the whole figure a floor, and summing pre-computed
 * totals would quietly drop that flag.
 */
export function combineForecasts(...forecasts: StageForecast[]): StageForecast {
  return collect(
    forecasts.flatMap((forecast) => forecast.lines),
    forecasts.reduce((sum, forecast) => sum + forecast.etaSeconds, 0),
  );
}

/**
 * `scene-generation.ts` switches to image-to-video only when a beat's @mentions resolved to
 * reference images, which the forecast cannot know without resolving them. It quotes the
 * text-to-video path — the two are the same order of magnitude in every configured pairing.
 */
const VIDEO_CAPABILITY: CapabilityKey = 'textToVideo';

/**
 * Forecast for one scene — the unit the Scenes room regenerates. `seconds` is that beat's
 * `durationSeconds`, which is what a per-second video model bills.
 */
export function forecastScene(input: ForecastInput, seconds: number): StageForecast {
  const capability = VIDEO_CAPABILITY;
  const { provider, model } = resolveModel(capability, input.modelConfig);
  const price = priceOf(provider, model);
  // 'call' and 'second' models bill on completely different axes — a per-call model charges the
  // same for a 4s and a 12s clip, so the unit count has to follow the price entry, not the clip.
  const units = price?.per === 'second' ? seconds : 1;

  return collect(
    [
      line('Compose the prompt', 'llmText', (input.briefChars + SCENE_COMPOSE_CHARS) / 1000, input.modelConfig),
      { ...line('Generate the clip', capability, units, input.modelConfig), unit: price?.per ?? 'call' },
    ],
    ETA.llmCall + ETA.videoCall,
  );
}

/** Forecast for every stage of an episode as it stands right now. */
export function forecastStage(kind: StageKind, input: ForecastInput): StageForecast {
  const { modelConfig, briefChars, sceneCount, totalSceneSeconds, dialogueChars } = input;
  const llm = (label: string, chars: number) => line(label, 'llmText', chars / 1000, modelConfig);

  switch (kind) {
    case 'RESEARCH': {
      // HUMAN pastes its own notes and SKIP completes empty — neither calls a model.
      if (input.researchMode === 'HUMAN' || input.researchMode === 'SKIP') return collect([], 0);
      // AI_REASONING is one brainstorm call with no web access; AI_CDP adds the ReAct tool loop,
      // whose cost is dominated by the page text it reads back into the context on every turn.
      const searches = input.researchMode === 'AI_CDP' ? aiConfig.limits.researchMaxSearches : 0;
      const readChars = searches * aiConfig.limits.researchPageChars;
      return collect(
        [llm('Research agent loop', briefChars + readChars + LLM_OUTPUT_CHARS.RESEARCH)],
        ETA.llmCall + searches * ETA.researchSearch,
      );
    }

    case 'IDEA':
      return collect([llm('Write the idea', briefChars + LLM_OUTPUT_CHARS.IDEA)], ETA.llmCall);

    case 'SCRIPT':
      return collect([llm('Write the scene breakdown', briefChars + LLM_OUTPUT_CHARS.SCRIPT)], ETA.llmCall);

    case 'BREAKDOWN':
      // Still the pass-through stub (`breakdown.node.ts`): it copies SCRIPT's output and calls no
      // model. T17 gives it a real LLM line when it starts cutting a screenplay into beats.
      return collect([], 0);

    case 'SCENES': {
      if (sceneCount === 0) return collect([], 0);
      const capability = VIDEO_CAPABILITY;
      const { provider, model } = resolveModel(capability, modelConfig);
      const price = priceOf(provider, model);
      const videoUnits = price?.per === 'second' ? totalSceneSeconds : sceneCount;
      // Beats run `sceneConcurrency` at a time, so wall clock is batches, not the sum.
      const batches = Math.ceil(sceneCount / aiConfig.limits.sceneConcurrency);
      return collect(
        [
          llm(`Compose ${sceneCount} prompts`, sceneCount * (briefChars + SCENE_COMPOSE_CHARS)),
          {
            ...line(`Generate ${sceneCount} clips`, capability, videoUnits, modelConfig),
            unit: price?.per ?? 'call',
          },
        ],
        batches * (ETA.llmCall + ETA.videoCall),
      );
    }

    case 'VOICE': {
      if (dialogueChars === 0) return collect([], 0);
      return collect(
        [
          llm('Plan the voice pass', briefChars + LLM_OUTPUT_CHARS.VOICE),
          line('Synthesize dialogue', 'tts', dialogueChars / 1000, modelConfig),
        ],
        ETA.llmCall + (dialogueChars / 1000) * ETA.ttsPer1kChars,
      );
    }

    case 'MUSIC':
      return collect(
        [
          llm('Write the music brief', briefChars + LLM_OUTPUT_CHARS.MUSIC),
          line('Generate the bed', 'music', totalSceneSeconds, modelConfig),
        ],
        ETA.llmCall + ETA.musicCall,
      );

    case 'RENDER':
      // ffmpeg runs locally: CPU time, no bill.
      return collect([], ETA.renderBase + sceneCount * ETA.renderPerScene);
  }
}

export type EpisodeForecast = Record<StageKind, StageForecast>;

export function forecastEpisode(input: ForecastInput): EpisodeForecast {
  return Object.fromEntries(
    STAGE_ORDER.map((kind) => [kind, forecastStage(kind, input)]),
  ) as EpisodeForecast;
}

/** One image render in the asset lab, per the same table the episode stages are priced from. */
const ASSET_SHOT_ETA_SECONDS = 20;

/**
 * What a lab sheet costs before the user presses Generate.
 *
 * Same rule as Approve: quote the spend that the click *starts*. A character turnaround is eight
 * images, and eight is where an image model stops being free-feeling — the number belongs on the
 * button, not in the invoice.
 */
export function forecastAssetShots(
  shotCount: number,
  modelConfig: ProjectModelConfig | undefined,
  /** After the anchor is locked, the remaining views run image-to-image instead of text-to-image. */
  referenceShotCount = 0,
): StageForecast {
  const textShots = Math.max(0, shotCount - referenceShotCount);
  const lines = [
    ...(textShots > 0 ? [line('Images from text', 'textToImage', textShots, modelConfig)] : []),
    ...(referenceShotCount > 0
      ? [line('Images from the reference', 'imageToImage', referenceShotCount, modelConfig)]
      : []),
  ];
  return collect(lines, shotCount * ASSET_SHOT_ETA_SECONDS);
}

export function formatEta(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `~${minutes} min`;
  return `~${Math.round((minutes / 60) * 10) / 10} hr`;
}
