import { Command, END, START, StateGraph } from '@langchain/langgraph';
import type { Prisma, StageKind } from '@prisma/client';

import { GRAPH_VERSION, INTERRUPT_AFTER, nextStageAfter } from '@/config/pipeline';
import { prisma } from '@/lib/prisma';
import type { ProjectModelConfig } from '@/providers/types';
import { assetService, contextService, episodeService, projectService } from '@/services';

import { getCheckpointer } from './checkpointer';
import { routeAfterIdeaCritic } from './routing';
import { withSceneRow } from './scene-io';
import { addStageCost } from './stage-io';
import { EpisodeGraphAnnotation, type EpisodeGraphState, type SceneResult, type SceneScope } from './state';

/*
 * Nodes are registered by reference, not by import.
 *
 * The graph's *shape* is what most callers need — `updateState` attributing a manual write with
 * `asNode`, `getState` reading a parked thread, `interruptAfter` deciding where to park — and none
 * of those execute a node body. Importing the bodies eagerly meant every one of those touches also
 * loaded LangChain, the research agent's browser stack and each provider SDK behind it, which is a
 * multi-second tax on a page that only wanted to read a checkpoint. Deferring the import to the call
 * moves that cost onto the run that actually needs it.
 */
const NODES = {
  RESEARCH: () => import('./nodes/research.node').then((m) => m.researchNode),
  IDEA: () => import('./nodes/idea.node').then((m) => m.ideaNode),
  IDEA_CRITIC: () => import('./nodes/idea-critic.node').then((m) => m.ideaCriticNode),
  SCRIPT: () => import('./nodes/script.node').then((m) => m.scriptNode),
  BREAKDOWN: () => import('./nodes/breakdown.node').then((m) => m.breakdownNode),
  SCENES: () => import('./nodes/scenes.node').then((m) => m.scenesNode),
  VOICE: () => import('./nodes/voice.node').then((m) => m.voiceNode),
  MUSIC: () => import('./nodes/music.node').then((m) => m.musicNode),
  RENDER: () => import('./nodes/render.node').then((m) => m.renderNode),
} as const;

function lazyNode(name: keyof typeof NODES) {
  return async (state: EpisodeGraphState) => (await NODES[name]())(state);
}

function buildGraph() {
  const g = new StateGraph(EpisodeGraphAnnotation)
    .addNode('RESEARCH', lazyNode('RESEARCH'))
    .addNode('IDEA', lazyNode('IDEA'))
    .addNode('IDEA_CRITIC', lazyNode('IDEA_CRITIC'))
    .addNode('SCRIPT', lazyNode('SCRIPT'))
    .addNode('BREAKDOWN', lazyNode('BREAKDOWN'))
    .addNode('SCENES', lazyNode('SCENES'))
    .addNode('VOICE', lazyNode('VOICE'))
    .addNode('MUSIC', lazyNode('MUSIC'))
    .addNode('RENDER', lazyNode('RENDER'))
    .addEdge(START, 'RESEARCH')
    .addEdge('RESEARCH', 'IDEA')
    .addEdge('IDEA', 'IDEA_CRITIC')
    .addConditionalEdges('IDEA_CRITIC', routeAfterIdeaCritic, ['RESEARCH', 'IDEA', 'SCRIPT'])
    .addEdge('SCRIPT', 'BREAKDOWN')
    .addEdge('BREAKDOWN', 'SCENES')
    .addEdge('SCENES', 'VOICE')
    .addEdge('VOICE', 'MUSIC')
    .addEdge('MUSIC', 'RENDER')
    .addEdge('RENDER', END);
  return g;
}

let compiledPromise: ReturnType<typeof compileGraph> | null = null;

async function compileGraph() {
  const checkpointer = await getCheckpointer();
  return buildGraph().compile({ checkpointer, interruptAfter: INTERRUPT_AFTER });
}

/**
 * Refuses to touch a checkpoint that was written against a different graph shape.
 *
 * The failure this prevents is silent, not loud: a v1 thread parked after SCRIPT carries
 * `next: ['SCENES']`, and resuming it under v2 skips BREAKDOWN and hands SCENES an empty breakdown.
 * Nothing throws — the user gets an episode with no scenes and no explanation. Checking the stamp
 * costs one indexed read per resume and turns that into a sentence someone can act on.
 */
async function assertGraphVersion(episodeId: string): Promise<void> {
  const episode = await prisma.episode.findUnique({ where: { id: episodeId }, select: { graphVersion: true } });
  if (!episode) throw new Error(`Episode ${episodeId} not found`);
  if (episode.graphVersion === GRAPH_VERSION) return;
  throw new Error(
    `Episode ${episodeId} was built with pipeline v${episode.graphVersion}, but this app runs v${GRAPH_VERSION}. ` +
      'Its saved progress was written against a different set of stages and cannot be resumed. Create a new episode.',
  );
}

/** The compiled graph is process-wide and reused across invocations — compiling per-call would drop the checkpointer setup. */
export function getEpisodeGraph() {
  if (!compiledPromise) compiledPromise = compileGraph();
  return compiledPromise;
}

function threadConfig(episodeId: string) {
  return { configurable: { thread_id: episodeId } };
}

type CompiledEpisodeGraph = Awaited<ReturnType<typeof compileGraph>>;

/**
 * Drops the tasks a previous run left queued on the thread, so the next entry runs only what the
 * user asked for.
 *
 * A superstep is only checkpointed once **every** task in it has written. When one node throws, the
 * loop never writes that checkpoint, so its tasks stay pending and LangGraph re-creates them on the
 * next entry — for ever. Enter upstream with `Command({ goto })` on top of that and the stale task
 * runs *alongside* the requested node: the two are separate `branch:to:*` triggers, so
 * `interruptAfter` cannot park between them, and the whole invoke then fails on the stale node's
 * error rather than on anything the user touched. Observed live as a SCRIPT regenerate that ran
 * BREAKDOWN, SCENES **and** MUSIC in one superstep and reported a music-provider 401 as the script's
 * failure — with `next` still `['SCRIPT','SCENES','MUSIC']` afterwards, so every later action paid
 * for the same three again.
 *
 * `updateState(config, null, END)` is the public "clear the queue" path: it consumes the pending
 * triggers into a fresh checkpoint and keeps the channel values, applying the writes of tasks that
 * *did* succeed and discarding the ones whose only write was `__error__`. `next` comes back empty,
 * and the `Command({ goto })` that follows is then the only thing that arms a node.
 *
 * Returns what it dropped, for the caller to log — a thread that had to be unwedged is worth a line.
 */
async function discardQueuedTasks(graph: CompiledEpisodeGraph, episodeId: string): Promise<string[]> {
  const config = threadConfig(episodeId);
  const snapshot = await graph.getState(config);
  const queued = [...snapshot.next];
  // No checkpoint, or nothing queued: `updateState` would only write an empty checkpoint.
  if (queued.length === 0) return [];
  await graph.updateState(config, null, END);
  return queued;
}

/** First run — seeds initial state and executes through RESEARCH, then parks at the interrupt. */
export async function runEpisodeGraph(episodeId: string, projectId: string): Promise<EpisodeGraphState> {
  await assertGraphVersion(episodeId);
  const graph = await getEpisodeGraph();
  return graph.invoke({ episodeId, projectId, costTotal: 0 } satisfies Partial<EpisodeGraphState>, threadConfig(episodeId));
}

/**
 * Approve — continues the parked thread into the next node, then parks again.
 *
 * `afterStage` is the stage that was just approved, and it is only consulted when the thread does
 * not hold exactly one queued node — the two states a plain `invoke(null)` gets wrong:
 *
 * - **forked** (several nodes queued, what a pre-`discardQueuedTasks` run could leave behind): a
 *   resume runs every one of them and bills all of them;
 * - **empty** (nothing queued, e.g. after a fork was discarded): a resume runs nothing at all, so
 *   Approve would report success and advance no stage.
 *
 * Both are repaired the same way — clear the queue, then arm the successor explicitly. The successor
 * comes from `STAGE_ORDER`, which is also what `routeAfterIdeaCritic` returns today; keep the two in
 * step when T19 turns that route into a real decision, or approving IDEA on a recovered thread will
 * skip the loop it adds.
 */
export async function resumeEpisodeGraph(episodeId: string, afterStage?: StageKind): Promise<EpisodeGraphState> {
  await assertGraphVersion(episodeId);
  const graph = await getEpisodeGraph();
  const config = threadConfig(episodeId);

  const snapshot = await graph.getState(config);
  if (snapshot.next.length !== 1 && afterStage) {
    const successor = nextStageAfter(afterStage);
    const dropped = await discardQueuedTasks(graph, episodeId);
    console.warn(
      `[pipeline] episode ${episodeId}: thread held ${dropped.length} queued nodes (${dropped.join(', ') || 'none'}) ` +
        `when ${afterStage} was approved — resuming at ${successor ?? 'END'} instead`,
    );
    if (!successor) return snapshot.values as EpisodeGraphState;
    return graph.invoke(new Command({ goto: successor, update: { episodeId } }), config);
  }

  return graph.invoke(null, config);
}

/**
 * Regenerate — jumps straight to `stage`'s node (its `withStage` wrapper detects the
 * non-PENDING row and bumps `attempt`), then re-parks at the same interrupt point.
 * `note` is the user's "make it darker" instruction; the node consumes and clears it.
 *
 * `sceneScope` only means anything for SCENES: `'all'` regenerates every beat, `'missing'` fills in
 * the beats that have no clip yet and leaves the generated ones (and their cost) alone.
 */
export async function regenerateEpisodeStage(
  episodeId: string,
  projectId: string,
  stage: StageKind,
  note?: string,
  sceneScope: SceneScope = 'all',
): Promise<EpisodeGraphState> {
  await assertGraphVersion(episodeId);
  const graph = await getEpisodeGraph();
  await discardQueuedTasks(graph, episodeId);
  return graph.invoke(
    new Command({ goto: stage, update: { episodeId, projectId, regenerateNote: note ?? '', sceneScope } }),
    threadConfig(episodeId),
  );
}

/**
 * Refine — re-enters IDEA with the `ideaMode` channel set, so `ideaNode` revises the idea that is
 * there instead of writing a new one. Structurally identical to `regenerateEpisodeStage('IDEA')`;
 * the only difference is the channel, and that difference is the whole feature.
 *
 * `note` is the user's steer ("make the ending land harder") and reaches the refine prompt through
 * the same `regenerateNote` channel a Regenerate uses — one note channel, consumed and cleared by
 * whichever prompt ran.
 */
export async function refineEpisodeIdea(
  episodeId: string,
  projectId: string,
  note?: string,
): Promise<EpisodeGraphState> {
  await assertGraphVersion(episodeId);
  const graph = await getEpisodeGraph();
  await discardQueuedTasks(graph, episodeId);
  return graph.invoke(
    new Command({ goto: 'IDEA', update: { episodeId, projectId, ideaMode: 'refine', regenerateNote: note ?? '' } }),
    threadConfig(episodeId),
  );
}

/**
 * Refine — re-enters SCRIPT with the `scriptMode` channel set, so `scriptNode` revises the
 * breakdown that is there instead of cutting a new one. Structurally identical to
 * `regenerateEpisodeStage('SCRIPT')`; the only difference is the channel, same relationship
 * `refineEpisodeIdea` has to `regenerateEpisodeStage('IDEA')`.
 */
export async function refineEpisodeScript(
  episodeId: string,
  projectId: string,
  note?: string,
): Promise<EpisodeGraphState> {
  await assertGraphVersion(episodeId);
  const graph = await getEpisodeGraph();
  await discardQueuedTasks(graph, episodeId);
  return graph.invoke(
    new Command({ goto: 'SCRIPT', update: { episodeId, projectId, scriptMode: 'refine', regenerateNote: note ?? '' } }),
    threadConfig(episodeId),
  );
}

/**
 * Regenerate exactly one scene, outside the graph's node/interrupt flow — SCENES stays a single
 * `EpisodeStage`, but each scene has its own `Scene` row (see scene-io.ts, T12). Reuses the SCENES
 * stage's original research dossier and the SCRIPT stage's breakdown rather than rerunning either;
 * only this one scene's generation call happens. The graph's checkpointed `scenes` channel is then
 * patched via `updateState` so a later RENDER (which reads that channel, not the DB) picks up the
 * new video instead of the stale one from the original batch.
 */
export async function regenerateEpisodeScene(
  episodeId: string,
  projectId: string,
  sceneIndex: number,
  note?: string,
): Promise<SceneResult> {
  await assertGraphVersion(episodeId);
  const graph = await getEpisodeGraph();
  const config = threadConfig(episodeId);
  const snapshot = await graph.getState(config);
  const current = snapshot.values as EpisodeGraphState;
  // Same precedence as `scenesNode`: the stored SCRIPT output carries the user's card edits.
  const script = (await episodeService.script(episodeId)) ?? current.script;
  if (!script) throw new Error('Cannot regenerate a scene before SCRIPT has completed');
  const sceneSpec = script.scenes.find((scene) => scene.index === sceneIndex);
  if (!sceneSpec) throw new Error(`Scene ${sceneIndex} not found in this episode's script`);

  // Same reason the nodes are lazy: these three reach the provider SDKs and the research agent's
  // browser stack, and this is the only function in the file that needs them.
  const [{ formatResearchDossier }, { buildAssetRoster }, { generateScene }] = await Promise.all([
    import('@/ai/research/research-agent'),
    import('@/assets/roster'),
    import('./scene-generation'),
  ]);

  const [project, bible, storedDossier, assets] = await Promise.all([
    projectService.get(projectId),
    contextService.getCharacterBible(projectId),
    episodeService.sceneResearch(episodeId),
    assetService.list(projectId),
  ]);
  if (!project) throw new Error(`Project ${projectId} not found`);
  const modelConfig = project.modelConfig as ProjectModelConfig | undefined;
  const characterBibleText = bible ? JSON.stringify(bible.lockedTraits) : 'none';
  const styleConfigText = project.styleConfig ? JSON.stringify(project.styleConfig) : 'none';
  const researchContext = formatResearchDossier(storedDossier);

  const generated = await withSceneRow(episodeId, sceneIndex, async () => {
    const output = await generateScene({
      projectId,
      scene: sceneSpec,
      characterBibleText,
      assetRosterText: buildAssetRoster(assets),
      styleConfigText,
      aspectRatio: project.aspectRatio,
      resolution: project.resolution,
      researchContext,
      revisionNote: note?.trim() || '(none)',
      modelConfig,
    });
    return {
      result: output,
      prompt: output.prompt,
      videoUrl: output.videoUrl,
      costEstimate: output.costEstimate,
      providerMeta: output.providerMeta as Prisma.InputJsonValue,
    };
  });

  await addStageCost(episodeId, 'SCENES', generated.costEstimate);

  const updatedScene: SceneResult = { index: generated.index, videoUrl: generated.videoUrl };

  // Patching the checkpoint is only safe once the SCENES node has actually run.
  //
  // `asNode: 'SCENES'` attributes the write to that node — which is what makes RENDER (it reads the
  // `scenes` channel, not the DB) see the new clip, but it also moves the thread's `next` to SCENES'
  // successor. On a thread still parked at `next: ['SCENES']` — exactly where a user sits when they
  // generate beats one card at a time before running the batch — that skips the batch entirely: the
  // next Approve would resume straight into VOICE with a mostly-empty `scenes` channel. An episode
  // with no checkpoint at all is the same hazard.
  //
  // So when the batch has not run, this returns without touching the graph: the `Scene` row is the
  // record of the clip, and `scenesNode` reads those rows back (scope `'missing'`) and writes the
  // full channel itself when the batch finally runs. Contrast `alignCheckpointAfterManualWrite`,
  // which *wants* to advance past a stage the user completed by hand — here the stage is a batch the
  // user has only partly done, and only its own node may declare it finished.
  const checkpointed = current.scenes;
  if (checkpointed && checkpointed.length > 0) {
    const nextScenes = checkpointed.some((scene) => scene.index === sceneIndex)
      ? checkpointed.map((scene) => (scene.index === sceneIndex ? updatedScene : scene))
      : [...checkpointed, updatedScene];
    await graph.updateState(config, { scenes: nextScenes } satisfies Partial<EpisodeGraphState>, 'SCENES');
  }

  return updatedScene;
}
