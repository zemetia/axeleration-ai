import { createReactAgent } from '@langchain/langgraph/prebuilt';
import type { StructuredToolInterface } from '@langchain/core/tools';

import { RESEARCH_STRUCTURED_RESPONSE_PROMPT, researchAgentSystemPrompt, researchUserPrompt } from '@/ai/prompts/research.prompt';
import { researchDossierSchema, type ResearchDossier } from '@/ai/prompts/research.schema';
import { getChatModel } from '@/ai/router/model-router';
import { aiConfig } from '@/config/ai';
import { getMcpTools } from '@/mcp';
import type { ProjectModelConfig } from '@/providers/types';

export interface RunResearchAgentInput {
  projectId: string;
  /** Why this research is happening, e.g. "ground this episode's scenes in real-world detail". */
  goal: string;
  /** What to actually investigate — e.g. the episode logline plus its scene descriptions. */
  target: string;
  /** What's already known (continuity summary, character bible) — the agent researches past this, not over it. */
  baseline: string;
  modelConfig?: ProjectModelConfig;
  /** Called with a short human-readable line — e.g. `Searching "..."` — each time a tool starts. */
  onActivity?: (activity: string) => void | Promise<void>;
}

/** Pulls the actual tool args out of either a raw args object or a LangGraph `ToolCall`-shaped input. */
function toolCallArgs(input: unknown): Record<string, unknown> {
  if (input && typeof input === 'object' && 'args' in input) {
    const { args } = input as { args: unknown };
    if (args && typeof args === 'object') return args as Record<string, unknown>;
  }
  return (input && typeof input === 'object' ? input : {}) as Record<string, unknown>;
}

/** Turns a tool call into the one-line status the UI shows while research runs. */
function describeToolCall(name: string, input: unknown): string {
  const args = toolCallArgs(input);
  switch (name) {
    case 'web_search':
    case 'search_x':
      return typeof args['query'] === 'string' ? `Searching "${args['query']}"` : 'Searching the web';
    case 'fetch_page':
    case 'fetch_url':
      return typeof args['url'] === 'string' ? `Reading ${args['url']}` : 'Reading a page';
    default:
      return `Running ${name}`;
  }
}

/** Reports each tool call to `onActivity` as it starts, without changing what the tool does. */
function withActivityReporting(
  tools: StructuredToolInterface[],
  onActivity: (activity: string) => void | Promise<void>,
): StructuredToolInterface[] {
  return tools.map((tool) => {
    const invoke = tool.invoke.bind(tool);
    tool.invoke = async (input, config) => {
      await onActivity(describeToolCall(tool.name, input));
      return invoke(input, config);
    };
    return tool;
  });
}

/**
 * Agentic (ReAct) research loop, not a pipeline stage: the model drives its own tools —
 * `web_search`, `fetch_url`, `fetch_page`, `search_x` — deciding what to look up, where, and when it
 * has enough (see `src/lib/web-research.ts` for the source ladder behind them), then restates its
 * own findings into `researchDossierSchema` via
 * `responseFormat` so nothing gets invented in translation. Callable on demand from any node that
 * needs grounded, source-backed detail (currently the SCENES node, see `scenes.node.ts`).
 */
export async function runResearchAgent(input: RunResearchAgentInput): Promise<ResearchDossier> {
  const maxSearches = aiConfig.limits.researchMaxSearches;
  const model = await getChatModel('research', { projectId: input.projectId, project: input.modelConfig });
  const toolset = await getMcpTools({ projectId: input.projectId, servers: ['research'] });
  const tools = input.onActivity ? withActivityReporting(toolset.tools, input.onActivity) : toolset.tools;

  try {
    const agent = createReactAgent({
      llm: model,
      tools,
      prompt: researchAgentSystemPrompt({ maxSearches, today: new Date().toISOString().slice(0, 10) }),
      // `method: 'jsonMode'` — `ChatOpenAI.withStructuredOutput()` defaults to the strict
      // `response_format: json_schema` wire format for any model not literally prefixed `gpt-3`/
      // `gpt-4`, which covers every non-OpenAI model this app routes through (DeepSeek direct, and
      // every Gemini/GLM/Qwen/Kimi/etc. id in the Sumopod catalog); most of those APIs 400 on it
      // ("response_format type is unavailable", confirmed against DeepSeek). `'functionCalling'`
      // isn't a safe fallback either — it forces `tool_choice` to a specific function, which DeepSeek
      // also rejects whenever the model is in thinking mode ("Thinking mode does not support this
      // tool_choice"). `jsonMode` sends neither a schema-typed `response_format` nor a forced
      // `tool_choice` — just `{ type: 'json_object' }` plus the shape spelled out in the prompt below
      // — which is the one structured-output path every provider here actually accepts.
      responseFormat: {
        schema: researchDossierSchema,
        prompt: RESEARCH_STRUCTURED_RESPONSE_PROMPT,
        method: 'jsonMode',
      },
    });

    const result = await agent.invoke(
      {
        messages: [
          { role: 'user', content: researchUserPrompt({ goal: input.goal, target: input.target, baseline: input.baseline }) },
        ],
      },
      // Backstop against a runaway loop — a search+read pair is ~2 graph steps; generous buffer for the final compile.
      { recursionLimit: maxSearches * 4 + 10 },
    );

    return researchDossierSchema.parse(result.structuredResponse);
  } finally {
    await toolset.close();
  }
}

/** Renders a dossier as plain-text bullets a prompt can embed directly; shared by every node that consumes one. */
export function formatResearchDossier(dossier: ResearchDossier | null): string {
  if (!dossier) return 'none';
  return dossier.findings
    .map((finding) => {
      const sources = finding.sources.length
        ? ` (${finding.sources.map((source) => source.url).join(', ')})`
        : '';
      return `- ${finding.claim}: ${finding.detail}${sources}`;
    })
    .join('\n');
}
