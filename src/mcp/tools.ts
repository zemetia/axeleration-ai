import { z } from 'zod';

import type { ManualStageKind } from '@/ai/graph/manual-authoring';
import { buildAssetProfile } from '@/assets/profile';
import { assetResolver, splitRefsForRequest } from '@/assets/resolver';
import { aiConfig } from '@/config/ai';
import { STAGE_ORDER } from '@/config/pipeline';
import { forecastEpisode, type ForecastInput } from '@/lib/cost-forecast';
import { httpFetch } from '@/lib/http-fetch';
import {
  ideaTextSchema,
  researchDossierPatchSchema,
  sceneSpecInputSchema,
  scriptPatchSchema,
} from '@/lib/validations/episode';
import { readPage, webSearch } from '@/lib/web-research';
import { xSearch } from '@/lib/x-search';
import { providerRegistry } from '@/providers/registry';
import { registerProviders } from '@/providers/register';
import type { Capability, ProjectModelConfig, ProviderRequest, ProviderResult } from '@/providers/types';
import { apiKeyService, assetService, contextService, episodeService, projectService } from '@/services';
import type { StageWrite, StageWriteFailure } from '@/services/episode.service';
import type { EpisodeWithStagesVO, SceneSpecPatch } from '@/types/value-objects';

/**
 * Tool schemas + handlers shared by every MCP server (`servers/*.server.ts`) and by the
 * LangChain bridge (`client.ts`). Servers stay thin wrappers so a handler can also be unit
 * tested — and compared for parity against the underlying service — without a transport.
 *
 * Every tool takes `projectId`: the LLM never picks it, `bindProjectScope` fixes it (see `scope.ts`).
 */

const projectId = z.string().min(1).describe('Project this call is scoped to');
const assetType = z.enum(['CHARACTER', 'PERSON', 'STYLE', 'LOCATION', 'MAP', 'PROP', 'AMBIENCE', 'VOICE']);
const aspectRatio = z.enum(['9:16', '16:9', '1:1']).optional();
const resolution = z.enum(['720p', '1080p', '4K']).optional();

const episodeId = z.string().min(1).describe('Episode this call targets — from list_episodes');
const stageKind = z.enum(STAGE_ORDER);
const sceneIndex = z
  .number()
  .int()
  .positive()
  .describe('A beat\'s `index` from get_episode. This is an identity, not a position — it does not shift when other beats are deleted');
const dialogueLines = z
  .array(
    z.object({
      shot: z.number().int().min(1).default(1).describe('Which shot the line is spoken over, 1-based'),
      speaker: z.string().max(80),
      delivery: z.string().max(120).default('').describe('How it is said, e.g. "whispered, out of breath"'),
      line: z.string().min(1).max(1000),
    }),
  )
  .max(40)
  .optional();

const shots = z
  .array(
    z.object({
      durationSeconds: z.number().int().min(1).max(600),
      camera: z.string().max(600).default('').describe('Framing + movement, e.g. "medium close-up, slow push in"'),
      action: z.string().max(2000).default('').describe('What the subject does. @handles are resolved to asset descriptions at generation time'),
    }),
  )
  .min(1)
  .max(20)
  .describe('The shots this one clip cuts between, in order — their durations are what set the scene length');

export const MCP_TOOL_SHAPES = {
  list_assets: { projectId, type: assetType.optional().describe('Filter by asset type') },
  get_asset: { projectId, handle: z.string().min(1).describe('Asset handle, e.g. "luna"') },
  resolve_mention: { projectId, text: z.string().describe('Prompt text that may contain @handle mentions') },
  get_character_bible: { projectId },
  get_continuity_state: { projectId },
  generate_image: { projectId, prompt: z.string().min(1), aspectRatio, resolution, seed: z.number().int().optional() },
  generate_video: {
    projectId,
    prompt: z.string().min(1),
    durationSeconds: z.number().positive().optional(),
    aspectRatio,
    resolution,
    seed: z.number().int().optional(),
  },
  generate_voice: { projectId, text: z.string().min(1), voiceId: z.string().min(1) },
  generate_music: { projectId, brief: z.string().min(1), durationSeconds: z.number().positive().optional() },
  web_search: {
    projectId,
    query: z.string().min(1),
    maxResults: z.number().int().min(1).max(10).default(5),
    recency: z
      .enum(['day', 'week', 'month', 'year', 'any'])
      .default('any')
      .describe('Restrict results to what was published inside this window — use it for "latest"/"today" questions'),
  },
  fetch_page: { projectId, url: z.string().url() },
  fetch_url: { projectId, url: z.string().url() },
  search_x: {
    projectId,
    query: z.string().min(1).describe('Supports X search syntax, e.g. `from:user`, `"exact phrase"`, `min_faves:100`, `-filter:replies`'),
    maxResults: z.number().int().min(1).max(25).default(10),
    mode: z.enum(['latest', 'top']).default('latest'),
  },

  list_episodes: { projectId },
  get_episode: { projectId, episodeId },
  forecast_episode: { projectId, episodeId },
  write_idea: { projectId, episodeId, text: z.string().min(1).describe('The whole idea, replacing whatever is there') },
  update_research: {
    projectId,
    episodeId,
    summary: z.string().max(10_000).optional(),
    findings: z
      .array(
        z.object({
          claim: z.string().min(1).max(300),
          detail: z.string().max(2000).default(''),
          sources: z
            .array(z.object({ url: z.string().url(), title: z.string().max(200).optional() }))
            .max(10)
            .default([]),
        }),
      )
      .max(50)
      .optional()
      .describe('Replaces the whole findings list — send the full array, not just the new entries'),
  },
  update_script: { projectId, episodeId, logline: z.string().max(500) },
  add_scene: {
    projectId,
    episodeId,
    style: z.string().max(1000).default('').describe('Film stock, grade, realism level, motion feel'),
    setting: z.string().max(2000).default('').describe('Location, time, conditions, environment. @handles are resolved at generation time'),
    shots,
    lighting: z.string().max(1000).default('').describe('Key light source, colour, contrast'),
    audio: z.string().max(1000).default('').describe('Ambience, sound effects, music — non-verbal only; spoken words go in `dialogue`'),
    dialogue: dialogueLines,
    negative: z.string().max(1000).default('').describe('What the shot must avoid'),
  },
  update_scene: {
    projectId,
    episodeId,
    sceneIndex,
    style: z.string().max(1000).optional(),
    setting: z.string().max(2000).optional(),
    shots: shots.optional(),
    lighting: z.string().max(1000).optional(),
    audio: z.string().max(1000).optional(),
    dialogue: dialogueLines,
    negative: z.string().max(1000).optional(),
  },
  delete_scene: { projectId, episodeId, sceneIndex },
  approve_stage: { projectId, episodeId, stage: stageKind },
  regenerate_stage: {
    projectId,
    episodeId,
    stage: stageKind,
    note: z.string().max(2000).optional().describe('Steer for this run, e.g. "make it darker"'),
    scope: z
      .enum(['missing', 'all'])
      .optional()
      .describe(
        'SCENES only. "all" (default) regenerates every beat; "missing" generates only the beats with no clip yet, keeping the ones already paid for.',
      ),
  },
  regenerate_scene: { projectId, episodeId, sceneIndex, note: z.string().max(2000).optional() },
} as const;

export type McpToolName = keyof typeof MCP_TOOL_SHAPES;

export const MCP_TOOL_DESCRIPTIONS: Record<McpToolName, string> = {
  list_assets: 'List the project\'s reusable assets (characters, styles, locations, props, voices) with their @handles.',
  get_asset: 'Read one asset by handle, including its reference file URL and voice id.',
  resolve_mention:
    'Rewrite text so every @handle is replaced by that asset\'s canonical description, and return the asset references to attach to a generation call.',
  get_character_bible: 'Read the project\'s locked character identity — use it so characters never drift between episodes.',
  get_continuity_state: 'Read the rolling summary of what has happened in the series so far.',
  generate_image: 'Generate an image. @mentions in the prompt are resolved and their reference images attached automatically.',
  generate_video: 'Generate a video clip. @mentions in the prompt are resolved and their reference images attached automatically.',
  generate_voice: 'Synthesize speech for a line of dialogue using a stored voice id.',
  generate_music: 'Generate a background music bed from a short brief.',
  web_search:
    'Search the live web and return matching page titles, URLs, and snippets. Set `recency` to bound results by publication date. Answers from Brave, DuckDuckGo via a local browser, or DuckDuckGo over plain HTTP, whichever is reachable — the `via` field says which.',
  fetch_page:
    'Open a URL in a real local browser and return its title and visible text — use this for pages whose content only appears after JavaScript runs (dashboards, feeds, SPAs).',
  fetch_url:
    'Fetch a URL directly over HTTP with no browser: much faster than fetch_page and the right tool for JSON APIs, RSS/Atom feeds, and plain or static HTML pages.',
  search_x:
    'Search X (Twitter) posts. Best for breaking announcements and practitioner reaction that has not been written up anywhere indexable yet. Posts are claims, not verified facts — corroborate before citing one.',

  list_episodes: 'List the project\'s episodes with their number, title and status.',
  get_episode:
    'Read one episode in full: every pipeline stage with its status and output, plus every scene beat with its prompt blocks, shots, dialogue, duration and generated clip. Start here before editing anything.',
  forecast_episode:
    'Estimate what each stage of this episode would cost in USD and how long it would take if run right now. Check this before calling approve_stage or any regenerate tool — scene generation is the expensive one.',
  write_idea:
    'Replace the episode\'s idea with your own text. A hand-written idea counts the same as a generated one: the stage becomes Ready and the script is written from this.',
  update_research:
    'Replace the research summary and/or the findings that ground the idea. Findings are replaced wholesale, so read them with get_episode first and send the full list back.',
  update_script: 'Replace the script\'s logline. Beats are edited one at a time with add_scene / update_scene / delete_scene.',
  add_scene:
    'Append a beat to the scene breakdown. One beat is one generated clip, written as the blocks that become its prompt — style, setting, shots, lighting, audio, dialogue, negative. It appears as a card ready to generate, and gets the next free index.',
  update_scene:
    'Rewrite one beat, block by block. Only the fields you send change; `shots` is replaced wholesale, so read it with get_episode first and send the full list back. This edits the script — the clip on screen does not change until regenerate_scene is called.',
  delete_scene: 'Remove a beat from the breakdown, along with any clip already generated for it. Not reversible.',
  approve_stage:
    'Accept a stage and start the next one. This spends money — approving the script starts generating every scene. Call forecast_episode first.',
  regenerate_stage:
    'Re-run a stage, discarding its current output (including anything written by hand) and everything downstream of it. Spends money; capped per stage.',
  regenerate_scene: 'Re-generate one scene\'s clip from its current beat text, leaving every other scene alone. Spends money.',
};

type ShapeOf<K extends McpToolName> = (typeof MCP_TOOL_SHAPES)[K];
type InputOf<K extends McpToolName> = z.infer<z.ZodObject<ShapeOf<K>>>;

async function requireProject(id: string) {
  const project = await projectService.get(id);
  if (!project) throw new Error(`Project ${id} not found`);
  return project;
}

/*
 * The pipeline runtime (Inngest client, LangGraph checkpoint alignment, Prisma) loads on demand.
 * Only the twelve episode tools need it, and pulling LangGraph plus every provider SDK into module
 * scope would tax `mcp:asset`, the research agent's in-process toolset, and this file's unit tests
 * alike — all of which touch none of it.
 */
async function episodeRuntime() {
  const [inngestClient, events, db] = await Promise.all([
    import('@/inngest/client'),
    import('@/inngest/events'),
    import('@/lib/prisma'),
  ]);
  return { inngest: inngestClient.inngest, ...events, prisma: db.prisma };
}

/** Kept separate from `episodeRuntime` so a hand-written edit never has to load Inngest or Prisma. */
async function graphAlignment() {
  const graph = await import('@/ai/graph/manual-authoring');
  return graph.alignCheckpointAfterManualWrite;
}

/**
 * Every episode tool re-checks that the episode belongs to the scoped project. The HTTP route
 * verifies the caller owns `projectId` (see `scope.ts`), so without this an otherwise-legitimate
 * client could reach any episode in the database by guessing an id.
 */
async function requireEpisode(id: string, epId: string): Promise<EpisodeWithStagesVO> {
  const episode = await episodeService.get(epId);
  if (!episode || episode.projectId !== id) throw new Error(`Episode ${epId} not found in project ${id}`);
  return episode;
}

const WRITE_FAILURES: Record<StageWriteFailure, string> = {
  'not-found': 'That stage or beat does not exist on this episode',
  generating: 'This stage is generating right now — wait for it to finish, then edit',
  limit: `An episode can hold at most ${aiConfig.limits.maxScenesPerEpisode} scenes`,
};

/**
 * Shared tail for every hand-written edit: report the failure reason, then tell the parked LangGraph
 * thread the work is done so a later Approve advances past the stage instead of regenerating over
 * the text. Mirrors `alignThread` in `episodes/actions.ts` — the web form and an MCP client must
 * leave the pipeline in the same state, or an edit made through one would be silently undone by the
 * other. The import is static here (unlike in the action) because nothing in a browser bundle
 * reaches this file.
 */
async function finishManualWrite(
  written: StageWrite<unknown>,
  epId: string,
  id: string,
  kind: ManualStageKind,
): Promise<{ saved: boolean; message?: string }> {
  if (!written.ok) return { saved: false, message: WRITE_FAILURES[written.reason] };
  try {
    const alignCheckpointAfterManualWrite = await graphAlignment();
    await alignCheckpointAfterManualWrite(epId, id, kind);
    return { saved: true };
  } catch (err) {
    console.error(`[mcp] checkpoint alignment failed for ${epId}/${kind}:`, err);
    return { saved: true, message: 'Saved — but the pipeline could not be advanced, so approving may regenerate this stage.' };
  }
}

/** Generation tools run with the project's own decrypted keys — the model never sees a credential. */
async function runGeneration(id: string, capability: Capability, req: ProviderRequest): Promise<ProviderResult> {
  registerProviders();
  const project = await requireProject(id);
  return providerRegistry.run(capability, req, {
    project: project.modelConfig as ProjectModelConfig | undefined,
    resolveApiKey: (provider, apiKeyId) => apiKeyService.getDecrypted(id, provider, apiKeyId).then((key) => key ?? ''),
  });
}

export const mcpToolHandlers = {
  async list_assets({ projectId: id, type }: InputOf<'list_assets'>) {
    const assets = await assetService.list(id, { type });
    return {
      assets: assets.map((asset) => ({
        handle: asset.handle,
        name: asset.name,
        type: asset.type,
        description: asset.description,
      })),
    };
  },

  async get_asset({ projectId: id, handle }: InputOf<'get_asset'>) {
    const asset = await assetService.get(id, handle);
    if (!asset) return { found: false as const, handle };
    return {
      found: true as const,
      handle: asset.handle,
      name: asset.name,
      type: asset.type,
      description: asset.description,
      refUrl: asset.refUrl,
      voiceId: asset.voiceId,
      attributes: asset.attributes,
      profile: buildAssetProfile(asset),
    };
  },

  async resolve_mention({ projectId: id, text }: InputOf<'resolve_mention'>) {
    return assetResolver.resolve(id, text);
  },

  async get_character_bible({ projectId: id }: InputOf<'get_character_bible'>) {
    const bible = await contextService.getCharacterBible(id);
    if (!bible) return { found: false as const };
    return { found: true as const, lockedTraits: bible.lockedTraits, seedImageUrl: bible.seedImageUrl, status: bible.status };
  },

  async get_continuity_state({ projectId: id }: InputOf<'get_continuity_state'>) {
    const state = await contextService.getContinuityState(id);
    return { summary: state.summary, lastEpisodeNo: state.lastEpisodeNo };
  },

  async generate_image({ projectId: id, prompt, aspectRatio: ar, resolution: res, seed }: InputOf<'generate_image'>) {
    const { rewritten, refs } = await assetResolver.resolve(id, prompt);
    const { referenceImages } = splitRefsForRequest(refs);
    const capability: Capability = referenceImages.length > 0 ? 'image-to-image' : 'text-to-image';
    return runGeneration(id, capability, { capability, prompt: rewritten, referenceImages, aspectRatio: ar, resolution: res, seed });
  },

  async generate_video({ projectId: id, prompt, durationSeconds, aspectRatio: ar, resolution: res, seed }: InputOf<'generate_video'>) {
    const { rewritten, refs } = await assetResolver.resolve(id, prompt);
    const { referenceImages } = splitRefsForRequest(refs);
    const capability: Capability = referenceImages.length > 0 ? 'image-to-video' : 'text-to-video';
    return runGeneration(id, capability, {
      capability,
      prompt: rewritten,
      referenceImages,
      durationSeconds,
      aspectRatio: ar,
      resolution: res,
      seed,
    });
  },

  async generate_voice({ projectId: id, text, voiceId }: InputOf<'generate_voice'>) {
    return runGeneration(id, 'tts', { capability: 'tts', prompt: text, voiceId });
  },

  async generate_music({ projectId: id, brief, durationSeconds }: InputOf<'generate_music'>) {
    return runGeneration(id, 'music', { capability: 'music', prompt: brief, durationSeconds });
  },

  async web_search({ query, maxResults, recency }: InputOf<'web_search'>) {
    return webSearch(query, { maxResults, recency });
  },

  async fetch_page({ url }: InputOf<'fetch_page'>) {
    return readPage(url);
  },

  async fetch_url({ url }: InputOf<'fetch_url'>) {
    const { json: _json, ...rest } = await httpFetch(url);
    // `body` already carries the JSON pretty-printed; returning the parsed object too just doubles it.
    return rest;
  },

  async search_x({ query, maxResults, mode }: InputOf<'search_x'>) {
    return xSearch(query, { maxResults, mode });
  },

  async list_episodes({ projectId: id }: InputOf<'list_episodes'>) {
    const episodes = await episodeService.listByProject(id);
    return {
      episodes: episodes.map((episode) => ({
        episodeId: episode.id,
        number: episode.number,
        title: episode.title,
        status: episode.status,
        researchMode: episode.researchMode,
        totalCost: episode.totalCost,
      })),
    };
  },

  async get_episode({ projectId: id, episodeId: epId }: InputOf<'get_episode'>) {
    const episode = await requireEpisode(id, epId);
    const scenes = await episodeService.scenes(epId);
    return {
      episodeId: episode.id,
      number: episode.number,
      title: episode.title,
      status: episode.status,
      researchMode: episode.researchMode,
      totalCost: episode.totalCost,
      stages: episode.stages.map((stage) => ({
        kind: stage.kind,
        status: stage.status,
        attempt: stage.attempt,
        output: stage.output,
        error: stage.error,
        costEstimate: stage.costEstimate,
      })),
      scenes: scenes.map((scene) => ({
        index: scene.index,
        status: scene.status,
        style: scene.style,
        setting: scene.setting,
        shots: scene.shots,
        lighting: scene.lighting,
        audio: scene.audio,
        dialogue: scene.dialogue,
        negative: scene.negative,
        durationSeconds: scene.durationSeconds,
        videoUrl: scene.videoUrl,
        costEstimate: scene.costEstimate,
      })),
    };
  },

  async forecast_episode({ projectId: id, episodeId: epId }: InputOf<'forecast_episode'>) {
    const episode = await requireEpisode(id, epId);
    const project = await requireProject(id);
    const [script, research, idea] = await Promise.all([
      episodeService.script(epId),
      episodeService.research(epId),
      episodeService.idea(epId),
    ]);
    const scenes = script?.scenes ?? [];

    const input: ForecastInput = {
      modelConfig: (project.modelConfig as ProjectModelConfig | null) ?? undefined,
      researchMode: episode.researchMode,
      sceneCount: scenes.length,
      totalSceneSeconds: scenes.reduce((sum, scene) => sum + scene.durationSeconds, 0),
      dialogueChars: scenes.reduce(
        (sum, scene) => sum + (scene.dialogue ?? []).reduce((chars, entry) => chars + entry.line.length, 0),
        0,
      ),
      briefChars: project.premise.length + research.summary.length + (idea?.length ?? 0),
    };

    return { currency: 'USD', accuracy: 'order-of-magnitude', stages: forecastEpisode(input) };
  },

  async write_idea({ projectId: id, episodeId: epId, text }: InputOf<'write_idea'>) {
    await requireEpisode(id, epId);
    return finishManualWrite(await episodeService.writeIdea(epId, ideaTextSchema.parse(text)), epId, id, 'IDEA');
  },

  async update_research({ projectId: id, episodeId: epId, summary, findings }: InputOf<'update_research'>) {
    await requireEpisode(id, epId);
    const patch = researchDossierPatchSchema.parse({
      ...(summary === undefined ? {} : { summary }),
      ...(findings === undefined ? {} : { findings }),
    });
    return finishManualWrite(await episodeService.updateResearchDossier(epId, patch), epId, id, 'RESEARCH');
  },

  async update_script({ projectId: id, episodeId: epId, logline }: InputOf<'update_script'>) {
    await requireEpisode(id, epId);
    return finishManualWrite(
      await episodeService.updateScript(epId, scriptPatchSchema.parse({ logline })),
      epId,
      id,
      'SCRIPT',
    );
  },

  async add_scene({ projectId: id, episodeId: epId, style, setting, shots: sceneShots, lighting, audio, dialogue, negative }: InputOf<'add_scene'>) {
    await requireEpisode(id, epId);
    const input = sceneSpecInputSchema.parse({
      style,
      setting,
      shots: sceneShots,
      lighting,
      audio,
      dialogue: dialogue ?? [],
      negative,
    });
    return finishManualWrite(await episodeService.addScriptScene(epId, input), epId, id, 'SCRIPT');
  },

  async update_scene({
    projectId: id,
    episodeId: epId,
    sceneIndex: index,
    style,
    setting,
    shots: sceneShots,
    lighting,
    audio,
    dialogue,
    negative,
  }: InputOf<'update_scene'>) {
    await requireEpisode(id, epId);
    // Absent keys must stay absent: `updateSceneSpec` treats `undefined` as "leave this block
    // alone", so spreading a plain object would blank every block the caller didn't mention.
    const patch: SceneSpecPatch = {
      ...(style === undefined ? {} : { style }),
      ...(setting === undefined ? {} : { setting }),
      ...(sceneShots === undefined ? {} : { shots: sceneShots }),
      ...(lighting === undefined ? {} : { lighting }),
      ...(audio === undefined ? {} : { audio }),
      ...(dialogue === undefined ? {} : { dialogue }),
      ...(negative === undefined ? {} : { negative }),
    };
    return finishManualWrite(await episodeService.updateSceneSpec(epId, index, patch), epId, id, 'SCRIPT');
  },

  async delete_scene({ projectId: id, episodeId: epId, sceneIndex: index }: InputOf<'delete_scene'>) {
    await requireEpisode(id, epId);
    return finishManualWrite(await episodeService.deleteScriptScene(epId, index), epId, id, 'SCRIPT');
  },

  async approve_stage({ projectId: id, episodeId: epId, stage }: InputOf<'approve_stage'>) {
    await requireEpisode(id, epId);
    const { inngest, stageApprove } = await episodeRuntime();
    await inngest.send(stageApprove.create({ episodeId: epId, stage }));
    return { started: true as const, stage, note: 'Queued. Poll get_episode for the status.' };
  },

  async regenerate_stage({ projectId: id, episodeId: epId, stage, note, scope }: InputOf<'regenerate_stage'>) {
    await requireEpisode(id, epId);
    const { inngest, stageRegenerate, prisma } = await episodeRuntime();
    const current = await prisma.episodeStage.findUnique({ where: { episodeId_kind: { episodeId: epId, kind: stage } } });
    if (current && current.attempt >= aiConfig.limits.maxRegenPerStage) {
      return { started: false as const, reason: `Regenerate limit (${aiConfig.limits.maxRegenPerStage}) reached for ${stage}` };
    }
    await inngest.send(stageRegenerate.create({ episodeId: epId, stage, note, scope }));
    return { started: true as const, stage, note: 'Queued. Poll get_episode for the status.' };
  },

  async regenerate_scene({ projectId: id, episodeId: epId, sceneIndex: index, note }: InputOf<'regenerate_scene'>) {
    await requireEpisode(id, epId);
    const { inngest, sceneRegenerate, prisma } = await episodeRuntime();
    const scene = await prisma.scene.findUnique({ where: { episodeId_index: { episodeId: epId, index } } });
    if (scene && scene.attempt >= aiConfig.limits.maxRegenPerStage) {
      return { started: false as const, reason: `Regenerate limit (${aiConfig.limits.maxRegenPerStage}) reached for scene ${index}` };
    }
    await inngest.send(sceneRegenerate.create({ episodeId: epId, projectId: id, sceneIndex: index, note }));
    return { started: true as const, sceneIndex: index, note: 'Queued. Poll get_episode for the status.' };
  },
} satisfies { [K in McpToolName]: (input: InputOf<K>) => Promise<unknown> };
