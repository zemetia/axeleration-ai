import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

import { MCP_TOOL_DESCRIPTIONS, MCP_TOOL_SHAPES, mcpToolHandlers } from '../tools';
import { jsonResult } from './result';

/** Read-only series memory: the locked character identity and the rolling continuity summary. */
export function buildContextServer(): McpServer {
  const server = new McpServer({ name: 'context', version: '1.0.0' });

  server.registerTool(
    'get_character_bible',
    { description: MCP_TOOL_DESCRIPTIONS.get_character_bible, inputSchema: MCP_TOOL_SHAPES.get_character_bible },
    async (args) => jsonResult(await mcpToolHandlers.get_character_bible(args)),
  );

  server.registerTool(
    'get_continuity_state',
    { description: MCP_TOOL_DESCRIPTIONS.get_continuity_state, inputSchema: MCP_TOOL_SHAPES.get_continuity_state },
    async (args) => jsonResult(await mcpToolHandlers.get_continuity_state(args)),
  );

  return server;
}
