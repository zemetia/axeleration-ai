import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

import { MCP_SERVER_BUILDERS, type McpServerName } from '../servers';

/**
 * Runs one server over stdio for an external MCP client (Claude Desktop, MCP Inspector):
 * `npm run mcp:asset`. Never write to stdout here — stdout is the JSON-RPC channel.
 */
export async function serveStdio(name: McpServerName): Promise<void> {
  const server = MCP_SERVER_BUILDERS[name]();
  await server.connect(new StdioServerTransport());
  console.error(`[mcp] ${name} server ready on stdio`);
}
