import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

import { MCP_TOOL_DESCRIPTIONS, MCP_TOOL_SHAPES, mcpToolHandlers } from '../tools';
import { jsonResult } from './result';

/** Asset lookup + mention resolution — the tools a node needs to keep characters and props consistent. */
export function buildAssetServer(): McpServer {
  const server = new McpServer({ name: 'asset', version: '1.0.0' });

  server.registerTool(
    'list_assets',
    { description: MCP_TOOL_DESCRIPTIONS.list_assets, inputSchema: MCP_TOOL_SHAPES.list_assets },
    async (args) => jsonResult(await mcpToolHandlers.list_assets(args)),
  );

  server.registerTool(
    'get_asset',
    { description: MCP_TOOL_DESCRIPTIONS.get_asset, inputSchema: MCP_TOOL_SHAPES.get_asset },
    async (args) => jsonResult(await mcpToolHandlers.get_asset(args)),
  );

  server.registerTool(
    'resolve_mention',
    { description: MCP_TOOL_DESCRIPTIONS.resolve_mention, inputSchema: MCP_TOOL_SHAPES.resolve_mention },
    async (args) => jsonResult(await mcpToolHandlers.resolve_mention(args)),
  );

  return server;
}
