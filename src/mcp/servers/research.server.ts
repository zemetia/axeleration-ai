import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

import { MCP_TOOL_DESCRIPTIONS, MCP_TOOL_SHAPES, mcpToolHandlers } from '../tools';
import { jsonResult } from './result';

/**
 * The research agent's window on the outside world: search (Brave → local Chrome → plain HTTP),
 * two ways to read a URL (rendered vs raw), and X. No paid key is required for any of them.
 */
export function buildResearchServer(): McpServer {
  const server = new McpServer({ name: 'research', version: '1.0.0' });

  server.registerTool(
    'web_search',
    { description: MCP_TOOL_DESCRIPTIONS.web_search, inputSchema: MCP_TOOL_SHAPES.web_search },
    async (args) => jsonResult(await mcpToolHandlers.web_search(args)),
  );

  server.registerTool(
    'fetch_page',
    { description: MCP_TOOL_DESCRIPTIONS.fetch_page, inputSchema: MCP_TOOL_SHAPES.fetch_page },
    async (args) => jsonResult(await mcpToolHandlers.fetch_page(args)),
  );

  server.registerTool(
    'fetch_url',
    { description: MCP_TOOL_DESCRIPTIONS.fetch_url, inputSchema: MCP_TOOL_SHAPES.fetch_url },
    async (args) => jsonResult(await mcpToolHandlers.fetch_url(args)),
  );

  server.registerTool(
    'search_x',
    { description: MCP_TOOL_DESCRIPTIONS.search_x, inputSchema: MCP_TOOL_SHAPES.search_x },
    async (args) => jsonResult(await mcpToolHandlers.search_x(args)),
  );

  return server;
}
