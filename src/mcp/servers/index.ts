import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

import { buildAssetServer } from './asset.server';
import { buildContextServer } from './context.server';
import { buildEpisodeServer } from './episode.server';
import { buildGenerationServer } from './generation.server';
import { buildResearchServer } from './research.server';

export const MCP_SERVER_BUILDERS = {
  asset: buildAssetServer,
  context: buildContextServer,
  episode: buildEpisodeServer,
  generation: buildGenerationServer,
  research: buildResearchServer,
} satisfies Record<string, () => McpServer>;

export type McpServerName = keyof typeof MCP_SERVER_BUILDERS;

export const MCP_SERVER_NAMES = Object.keys(MCP_SERVER_BUILDERS) as McpServerName[];

export function isMcpServerName(value: string): value is McpServerName {
  return value in MCP_SERVER_BUILDERS;
}

export { buildAssetServer, buildContextServer, buildEpisodeServer, buildGenerationServer, buildResearchServer };
