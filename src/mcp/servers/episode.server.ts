import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

import { MCP_TOOL_DESCRIPTIONS, MCP_TOOL_SHAPES, mcpToolHandlers } from '../tools';
import { jsonResult } from './result';

/**
 * The episode control room, as tools.
 *
 * This is the surface an *external* assistant works through: the user talks to their own AI, that
 * AI reads the episode and edits it here, and the web UI shows the result. It deliberately mirrors
 * what a person can do on the page rather than exposing anything extra — same services, same Zod
 * schemas, same checkpoint alignment — so an episode half-written by hand and half by an MCP client
 * is not a special case.
 *
 * Reads and writes are free; only `approve_stage` and the two regenerate tools spend money, which
 * is why `forecast_episode` sits next to them.
 *
 * Never add this server to an internal agent's `getMcpTools({ servers })` list. The research agent
 * reads attacker-writable web pages, and these tools delete beats and start paid generations —
 * exactly what a prompt-injected page would ask for. It stays an external, user-driven surface.
 *
 * Registrations are written out one by one rather than looped over a name list: `registerTool`
 * infers the handler's argument type from the `inputSchema` it is given in the same call, and a
 * loop collapses that to a union the handler can no longer be typed against.
 */
export function buildEpisodeServer(): McpServer {
  const server = new McpServer({ name: 'episode', version: '1.0.0' });

  server.registerTool(
    'list_episodes',
    { description: MCP_TOOL_DESCRIPTIONS.list_episodes, inputSchema: MCP_TOOL_SHAPES.list_episodes },
    async (args) => jsonResult(await mcpToolHandlers.list_episodes(args)),
  );

  server.registerTool(
    'get_episode',
    { description: MCP_TOOL_DESCRIPTIONS.get_episode, inputSchema: MCP_TOOL_SHAPES.get_episode },
    async (args) => jsonResult(await mcpToolHandlers.get_episode(args)),
  );

  server.registerTool(
    'forecast_episode',
    { description: MCP_TOOL_DESCRIPTIONS.forecast_episode, inputSchema: MCP_TOOL_SHAPES.forecast_episode },
    async (args) => jsonResult(await mcpToolHandlers.forecast_episode(args)),
  );

  server.registerTool(
    'write_idea',
    { description: MCP_TOOL_DESCRIPTIONS.write_idea, inputSchema: MCP_TOOL_SHAPES.write_idea },
    async (args) => jsonResult(await mcpToolHandlers.write_idea(args)),
  );

  server.registerTool(
    'update_research',
    { description: MCP_TOOL_DESCRIPTIONS.update_research, inputSchema: MCP_TOOL_SHAPES.update_research },
    async (args) => jsonResult(await mcpToolHandlers.update_research(args)),
  );

  server.registerTool(
    'update_script',
    { description: MCP_TOOL_DESCRIPTIONS.update_script, inputSchema: MCP_TOOL_SHAPES.update_script },
    async (args) => jsonResult(await mcpToolHandlers.update_script(args)),
  );

  server.registerTool(
    'add_scene',
    { description: MCP_TOOL_DESCRIPTIONS.add_scene, inputSchema: MCP_TOOL_SHAPES.add_scene },
    async (args) => jsonResult(await mcpToolHandlers.add_scene(args)),
  );

  server.registerTool(
    'update_scene',
    { description: MCP_TOOL_DESCRIPTIONS.update_scene, inputSchema: MCP_TOOL_SHAPES.update_scene },
    async (args) => jsonResult(await mcpToolHandlers.update_scene(args)),
  );

  server.registerTool(
    'delete_scene',
    { description: MCP_TOOL_DESCRIPTIONS.delete_scene, inputSchema: MCP_TOOL_SHAPES.delete_scene },
    async (args) => jsonResult(await mcpToolHandlers.delete_scene(args)),
  );

  server.registerTool(
    'approve_stage',
    { description: MCP_TOOL_DESCRIPTIONS.approve_stage, inputSchema: MCP_TOOL_SHAPES.approve_stage },
    async (args) => jsonResult(await mcpToolHandlers.approve_stage(args)),
  );

  server.registerTool(
    'regenerate_stage',
    { description: MCP_TOOL_DESCRIPTIONS.regenerate_stage, inputSchema: MCP_TOOL_SHAPES.regenerate_stage },
    async (args) => jsonResult(await mcpToolHandlers.regenerate_stage(args)),
  );

  server.registerTool(
    'regenerate_scene',
    { description: MCP_TOOL_DESCRIPTIONS.regenerate_scene, inputSchema: MCP_TOOL_SHAPES.regenerate_scene },
    async (args) => jsonResult(await mcpToolHandlers.regenerate_scene(args)),
  );

  return server;
}
