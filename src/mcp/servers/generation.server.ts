import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

import { MCP_TOOL_DESCRIPTIONS, MCP_TOOL_SHAPES, mcpToolHandlers } from '../tools';
import { jsonResult } from './result';

/**
 * Thin MCP wrapper over the provider registry, so a node can be *agentic* about generation when we
 * want the model to choose. The deterministic pipeline path still calls `providerRegistry.run`
 * directly (T04 nodes) — these tools are the opt-in surface, never reachable from user-facing chat.
 */
export function buildGenerationServer(): McpServer {
  const server = new McpServer({ name: 'generation', version: '1.0.0' });

  server.registerTool(
    'generate_image',
    { description: MCP_TOOL_DESCRIPTIONS.generate_image, inputSchema: MCP_TOOL_SHAPES.generate_image },
    async (args) => jsonResult(await mcpToolHandlers.generate_image(args)),
  );

  server.registerTool(
    'generate_video',
    { description: MCP_TOOL_DESCRIPTIONS.generate_video, inputSchema: MCP_TOOL_SHAPES.generate_video },
    async (args) => jsonResult(await mcpToolHandlers.generate_video(args)),
  );

  server.registerTool(
    'generate_voice',
    { description: MCP_TOOL_DESCRIPTIONS.generate_voice, inputSchema: MCP_TOOL_SHAPES.generate_voice },
    async (args) => jsonResult(await mcpToolHandlers.generate_voice(args)),
  );

  server.registerTool(
    'generate_music',
    { description: MCP_TOOL_DESCRIPTIONS.generate_music, inputSchema: MCP_TOOL_SHAPES.generate_music },
    async (args) => jsonResult(await mcpToolHandlers.generate_music(args)),
  );

  return server;
}
