import type { aiConfig } from '@/config/ai';
import { STAGE_ORDER } from '@/config/pipeline';
import { resolveModel } from '@/lib/cost-forecast';
import type { ProjectModelConfig } from '@/providers/types';
import type { ResearchMode, StageKind } from '@prisma/client';

/**
 * Whether a stage can actually run *before* it is started.
 *
 * The pipeline used to answer this the expensive way: the user approved a stage, the node resolved
 * a provider, `resolveApiKey` threw `No API key configured for provider "anthropic"`, and the
 * failure surfaced minutes later as a FAILED row with `attempt=5`. Every part of that answer is
 * knowable up front — which capabilities a stage calls, which provider each one resolves to, and
 * whether that provider has a credential — so this module computes it and the UI blocks the button.
 *
 * Deliberately pure and dependency-free, for the same reason `cost-forecast.ts` is: importing the
 * registry would drag every provider adapter into whatever renders the banner. It shares that
 * module's `resolveModel`, so the provider a stage is *checked* against is by construction the one
 * it will be *billed* for. The caller supplies `availableProviders` — see
 * `credentialedProviders()` in `src/services/apikey.service.ts` for the server-side half.
 */

type CapabilityKey = keyof typeof aiConfig.defaults;

/** Runs locally (ffmpeg) — no credential, never blocks a run. */
const LOCAL_CAPABILITIES: readonly CapabilityKey[] = ['videoAssembly'];

const CAPABILITY_LABELS: Record<CapabilityKey, string> = {
  llmText: 'Writing (text model)',
  textToImage: 'Still images',
  imageToImage: 'Image editing',
  textToVideo: 'Video clips',
  imageToVideo: 'Video from a reference image',
  tts: 'Voice (text to speech)',
  music: 'Music',
  videoAssembly: 'Final render',
};

/** Everything the check needs about an episode, gathered by the caller (server-side). */
export interface ReadinessInput {
  modelConfig: ProjectModelConfig | undefined;
  researchMode: ResearchMode;
  /** Beats currently in the SCRIPT breakdown. */
  sceneCount: number;
  /** Characters of spoken dialogue across every beat — zero means VOICE never calls TTS. */
  dialogueChars: number;
  /** Provider ids the user has an active saved key for. Satisfies any capability. */
  availableProviders: readonly string[];
  /**
   * Provider ids backed by a platform environment variable. Deliberately narrower than
   * `availableProviders`: the env fallback lives in `resolveApiKey` inside `model-router.ts`, which
   * only the LLM path goes through — `voice.node.ts`, `music.node.ts` and `scene-generation.ts`
   * call `apiKeyService.getDecrypted` and get `''` with no fallback. Treating these as universal
   * would green-light a SCENES run that has no video credential at all.
   */
  platformProviders: readonly string[];
}

export interface MissingCredential {
  capability: CapabilityKey;
  /** Human-facing name of what the missing key buys — "Video clips", not "textToVideo". */
  label: string;
  provider: string;
  model: string;
}

export interface StageReadiness {
  isReady: boolean;
  missing: MissingCredential[];
}

/**
 * Which capabilities a stage will call, given what the episode currently holds.
 *
 * Mirrors the branches in `forecastStage` one for one: a stage that is forecast at zero cost
 * because it never calls a provider must not be reported as blocked either. Keep the two in step —
 * they answer the same question ("what will this stage invoke?") for money and for credentials.
 */
export function stageCapabilities(kind: StageKind, input: ReadinessInput): CapabilityKey[] {
  switch (kind) {
    case 'RESEARCH':
      // HUMAN pastes its own notes and SKIP completes empty — neither calls a model.
      return input.researchMode === 'HUMAN' || input.researchMode === 'SKIP' ? [] : ['llmText'];
    case 'IDEA':
    case 'SCRIPT':
      return ['llmText'];
    // The pass-through stub calls no model, so it can never be blocked on a credential. Forecast at
    // zero for the same reason — the two must stay in step (see this function's doc comment).
    case 'BREAKDOWN':
      return [];
    case 'SCENES':
      return input.sceneCount === 0 ? [] : ['llmText', 'textToVideo'];
    case 'VOICE':
      return input.dialogueChars === 0 ? [] : ['llmText', 'tts'];
    case 'MUSIC':
      return ['llmText', 'music'];
    case 'RENDER':
      return ['videoAssembly'];
  }
}

function isSatisfied(capability: CapabilityKey, provider: string, input: ReadinessInput): boolean {
  if (LOCAL_CAPABILITIES.includes(capability)) return true;
  if (input.availableProviders.includes(provider)) return true;
  return capability === 'llmText' && input.platformProviders.includes(provider);
}

export function readinessForStage(kind: StageKind, input: ReadinessInput): StageReadiness {
  const missing: MissingCredential[] = [];

  for (const capability of stageCapabilities(kind, input)) {
    const { provider, model } = resolveModel(capability, input.modelConfig);
    if (isSatisfied(capability, provider, input)) continue;
    // One capability per entry: two stages blocked on the same provider should still name the
    // capability the user was trying to use, because that is what they came to the screen to do.
    missing.push({ capability, label: CAPABILITY_LABELS[capability], provider, model });
  }

  return { isReady: missing.length === 0, missing };
}

export interface EpisodeReadiness {
  stages: Record<StageKind, StageReadiness>;
  /** Every distinct missing credential across the whole episode, de-duplicated by provider+capability. */
  missing: MissingCredential[];
  /** True when nothing anywhere in the pipeline is blocked. */
  isReady: boolean;
}

export function readinessForEpisode(input: ReadinessInput): EpisodeReadiness {
  const stages = Object.fromEntries(
    STAGE_ORDER.map((kind) => [kind, readinessForStage(kind, input)]),
  ) as Record<StageKind, StageReadiness>;

  const seen = new Set<string>();
  const missing: MissingCredential[] = [];
  for (const kind of STAGE_ORDER) {
    for (const entry of stages[kind].missing) {
      const key = `${entry.provider}:${entry.capability}`;
      if (seen.has(key)) continue;
      seen.add(key);
      missing.push(entry);
    }
  }

  return { stages, missing, isReady: missing.length === 0 };
}

/**
 * One-line reason a button is disabled. Names the provider, because "add an API key" is not
 * actionable when the app supports a dozen of them.
 *
 * Takes `undefined` so a caller can pass a still-loading query result straight through: an unknown
 * readiness is not a block, and blocking on it would grey out every button on first paint.
 */
export function blockedReason(readiness: StageReadiness | undefined): string | null {
  if (!readiness || readiness.isReady) return null;
  const [first, ...rest] = readiness.missing;
  if (!first) return null;
  const others =
    rest.length > 0 ? `, and ${rest.length} more capabilit${rest.length === 1 ? 'y' : 'ies'}` : '';
  return `Needs ${article(first.provider)} ${first.provider} API key for ${first.label.toLowerCase()}${others}.`;
}

/**
 * Provider ids are interpolated straight into prose, and half of them start with a vowel
 * ("a elevenlabs key", "a openai key"). Initial-letter agreement is all that is needed here —
 * these are lowercase ASCII ids, not arbitrary English.
 */
export function article(word: string): 'a' | 'an' {
  return /^[aeiou]/i.test(word) ? 'an' : 'a';
}
