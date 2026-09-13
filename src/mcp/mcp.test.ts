/**
 * @vitest-environment node
 *
 * Server-side only: the MCP SDK and the LangChain bridge are Node modules, and loading them under
 * jsdom is both pointless and dramatically slower.
 */
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AssetVO } from '@/types/value-objects';

const mocks = vi.hoisted(() => ({
  byHandles: vi.fn(),
  list: vi.fn(),
  get: vi.fn(),
  getCharacterBible: vi.fn(),
  getContinuityState: vi.fn(),
  projectGet: vi.fn(),
  getDecrypted: vi.fn(),
  run: vi.fn(),
  webSearch: vi.fn(),
  readPage: vi.fn(),
  httpFetch: vi.fn(),
  xSearch: vi.fn(),
  episodeGet: vi.fn(),
  episodeScenes: vi.fn(),
  updateSceneSpec: vi.fn(),
}));

vi.mock('@/services', () => ({
  assetService: { byHandles: mocks.byHandles, list: mocks.list, get: mocks.get },
  contextService: { getCharacterBible: mocks.getCharacterBible, getContinuityState: mocks.getContinuityState },
  projectService: { get: mocks.projectGet },
  apiKeyService: { getDecrypted: mocks.getDecrypted },
  episodeService: { get: mocks.episodeGet, scenes: mocks.episodeScenes, updateSceneSpec: mocks.updateSceneSpec },
}));
// Alignment is exercised in the graph's own tests; here it only needs to not touch a real checkpoint.
vi.mock('@/ai/graph/manual-authoring', () => ({ alignCheckpointAfterManualWrite: vi.fn() }));

// Adapters pull in vendor SDKs; the registry itself is covered by `providers/registry.test.ts`.
vi.mock('@/providers/register', () => ({ registerProviders: vi.fn() }));
vi.mock('@/providers/registry', () => ({ providerRegistry: { run: mocks.run } }));
// The real modules hit the live web (and a local Chrome over CDP) — not something a unit test should touch.
vi.mock('@/lib/web-research', () => ({ webSearch: mocks.webSearch, readPage: mocks.readPage }));
vi.mock('@/lib/http-fetch', () => ({ httpFetch: mocks.httpFetch }));
vi.mock('@/lib/x-search', () => ({ xSearch: mocks.xSearch }));

const { assetResolver } = await import('@/assets/resolver');
const { buildAssetServer, buildContextServer, buildEpisodeServer, buildGenerationServer, buildResearchServer } =
  await import('./servers');
const { getMcpTools } = await import('./client');
const { mcpToolHandlers } = await import('./tools');

const PROJECT = 'project-1';

function makeAsset(overrides: Partial<AssetVO> = {}): AssetVO {
  return {
    id: 'asset-1',
    projectId: PROJECT,
    type: 'CHARACTER',
    typeLabel: 'Character',
    lab: null,
    handle: 'luna',
    name: 'Luna',
    description: 'Luna (silver hair, red scarf)',
    refUrl: 'http://localhost:3000/media/luna.png',
    voiceId: null,
    attributes: {},
    status: 'ACTIVE',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

async function connect(server: ReturnType<typeof buildAssetServer>): Promise<Client> {
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'test-client', version: '1.0.0' });
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  return client;
}

function textOf(result: unknown): string {
  const content = (result as { content?: unknown }).content;
  const [block] = (Array.isArray(content) ? content : []) as { type: string; text: string }[];
  if (!block) throw new Error('tool returned no content');
  return block.text;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('MCP servers', () => {
  it('each server starts in-process and lists its tools', async () => {
    const cases: [ReturnType<typeof buildAssetServer>, string[]][] = [
      [buildAssetServer(), ['list_assets', 'get_asset', 'resolve_mention']],
      [buildContextServer(), ['get_character_bible', 'get_continuity_state']],
      [buildGenerationServer(), ['generate_image', 'generate_video', 'generate_voice', 'generate_music']],
      [buildResearchServer(), ['web_search', 'fetch_page', 'fetch_url', 'search_x']],
      [
        buildEpisodeServer(),
        [
          'list_episodes',
          'get_episode',
          'forecast_episode',
          'write_idea',
          'update_research',
          'update_script',
          'add_scene',
          'update_scene',
          'delete_scene',
          'approve_stage',
          'regenerate_stage',
          'regenerate_scene',
        ],
      ],
    ];

    for (const [server, expected] of cases) {
      const client = await connect(server);
      const { tools } = await client.listTools();
      expect(tools.map((tool) => tool.name).sort()).toEqual([...expected].sort());
      await client.close();
    }
  });

  it('resolve_mention over MCP matches calling the resolver directly', async () => {
    mocks.byHandles.mockResolvedValue([makeAsset()]);
    const text = 'Wide shot of @luna on the rooftop';

    const direct = await assetResolver.resolve(PROJECT, text);
    const client = await connect(buildAssetServer());
    const result = await client.callTool({ name: 'resolve_mention', arguments: { projectId: PROJECT, text } });

    expect(JSON.parse(textOf(result))).toEqual(direct);
    await client.close();
  });

  it('generation tools resolve mentions and route to the provider registry', async () => {
    mocks.byHandles.mockResolvedValue([makeAsset()]);
    mocks.projectGet.mockResolvedValue({ id: PROJECT, modelConfig: null });
    mocks.getDecrypted.mockResolvedValue('sk-test');
    mocks.run.mockResolvedValue({
      outputs: [{ url: 'http://localhost:3000/media/out.mp4', kind: 'video' }],
      providerMeta: { provider: 'fal', model: 'x', latencyMs: 1 },
    });

    await mcpToolHandlers.generate_video({ projectId: PROJECT, prompt: 'A shot of @luna walking' });

    expect(mocks.run).toHaveBeenCalledTimes(1);
    const [capability, request] = mocks.run.mock.calls[0] as [string, { prompt: string; referenceImages: unknown[] }];
    // A resolved CHARACTER mention means there is a reference image, so this is image-to-video.
    expect(capability).toBe('image-to-video');
    expect(request.prompt).toBe('A shot of Luna (silver hair, red scarf) walking');
    expect(request.referenceImages).toHaveLength(1);
  });

  it('research tools pass their options through to the source layer', async () => {
    mocks.webSearch.mockResolvedValue({ results: [{ title: 'Result', url: 'https://example.com', snippet: '…' }], via: 'brave' });
    mocks.readPage.mockResolvedValue({ title: 'Result', url: 'https://example.com', textContent: 'body text', via: 'browser' });
    mocks.xSearch.mockResolvedValue({ posts: [], via: 'api', query: 'nextjs 16' });

    const search = await mcpToolHandlers.web_search({
      projectId: PROJECT,
      query: 'gang becek jakarta 90an',
      maxResults: 5,
      recency: 'week',
    });
    expect(mocks.webSearch).toHaveBeenCalledWith('gang becek jakarta 90an', { maxResults: 5, recency: 'week' });
    expect(search).toMatchObject({ via: 'brave' });

    const page = await mcpToolHandlers.fetch_page({ projectId: PROJECT, url: 'https://example.com' });
    expect(mocks.readPage).toHaveBeenCalledWith('https://example.com');
    expect(page).toMatchObject({ textContent: 'body text', via: 'browser' });

    await mcpToolHandlers.search_x({ projectId: PROJECT, query: 'nextjs 16', maxResults: 10, mode: 'latest' });
    expect(mocks.xSearch).toHaveBeenCalledWith('nextjs 16', { maxResults: 10, mode: 'latest' });
  });

  it('fetch_url returns the response text without duplicating it as parsed JSON', async () => {
    mocks.httpFetch.mockResolvedValue({
      url: 'https://api.example.com/x',
      status: 200,
      contentType: 'application/json',
      json: { hits: [1, 2] },
      body: '{ "hits": [1, 2] }',
      truncated: false,
    });

    const result = await mcpToolHandlers.fetch_url({ projectId: PROJECT, url: 'https://api.example.com/x' });

    expect(result).toEqual({
      url: 'https://api.example.com/x',
      status: 200,
      contentType: 'application/json',
      body: '{ "hits": [1, 2] }',
      truncated: false,
    });
  });
});

describe('episode tools', () => {
  it('refuses an episode that belongs to another project', async () => {
    mocks.episodeGet.mockResolvedValue({ id: 'ep-1', projectId: 'someone-elses-project', stages: [] });

    // `projectId` is pinned by the transport, so this is the only check standing between a guessed
    // episode id and another user's episode.
    await expect(mcpToolHandlers.get_episode({ projectId: PROJECT, episodeId: 'ep-1' })).rejects.toThrow(/not found/);
    expect(mocks.episodeScenes).not.toHaveBeenCalled();
  });

  it('omits absent fields from a scene patch so they are left alone', async () => {
    mocks.episodeGet.mockResolvedValue({ id: 'ep-1', projectId: PROJECT, stages: [] });
    mocks.updateSceneSpec.mockResolvedValue({ ok: true, value: {} });

    await mcpToolHandlers.update_scene({ projectId: PROJECT, episodeId: 'ep-1', sceneIndex: 3, setting: 'Rain' });

    // `style: undefined` would read as "leave it", but sending the key at all risks a caller or
    // schema default turning it into an explicit blanking — so it must not be there.
    expect(mocks.updateSceneSpec).toHaveBeenCalledWith('ep-1', 3, { setting: 'Rain' });
  });

  it('blanks a block only when an empty string is sent for it', async () => {
    mocks.episodeGet.mockResolvedValue({ id: 'ep-1', projectId: PROJECT, stages: [] });
    mocks.updateSceneSpec.mockResolvedValue({ ok: true, value: {} });

    await mcpToolHandlers.update_scene({ projectId: PROJECT, episodeId: 'ep-1', sceneIndex: 3, negative: '' });

    expect(mocks.updateSceneSpec).toHaveBeenCalledWith('ep-1', 3, { negative: '' });
  });

  it('reports a refused write instead of claiming success', async () => {
    mocks.episodeGet.mockResolvedValue({ id: 'ep-1', projectId: PROJECT, stages: [] });
    mocks.updateSceneSpec.mockResolvedValue({ ok: false, reason: 'generating' });

    const result = await mcpToolHandlers.update_scene({
      projectId: PROJECT,
      episodeId: 'ep-1',
      sceneIndex: 3,
      setting: 'Rain',
    });

    expect(result).toMatchObject({ saved: false });
  });
});

describe('getMcpTools', () => {
  it('returns LangChain tools a node can bind and call', async () => {
    mocks.getCharacterBible.mockResolvedValue({ lockedTraits: { hair: 'silver' }, seedImageUrl: null, status: 'ready' });

    const toolset = await getMcpTools({ projectId: PROJECT });
    const bible = toolset.tools.find((tool) => tool.name === 'get_character_bible');
    expect(bible).toBeDefined();

    const output = await bible?.invoke({});
    expect(JSON.parse(String(output))).toMatchObject({ found: true, lockedTraits: { hair: 'silver' } });
    await toolset.close();
  });

  it('hides projectId from the model and pins it server-side', async () => {
    mocks.getContinuityState.mockResolvedValue({ summary: 'so far…', lastEpisodeNo: 2 });

    const toolset = await getMcpTools({ projectId: PROJECT });
    const continuity = toolset.tools.find((tool) => tool.name === 'get_continuity_state');

    // A prompt-injected attempt to reach another project is stripped by the scoped schema.
    await continuity?.invoke({ projectId: 'someone-elses-project' });

    expect(mocks.getContinuityState).toHaveBeenCalledWith(PROJECT);
    await toolset.close();
  });
});
