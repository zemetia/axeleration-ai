import { loadMcpTools } from '@langchain/mcp-adapters';
import type { StructuredToolInterface } from '@langchain/core/tools';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';

import { bindProjectScope } from './scope';
import { MCP_SERVER_BUILDERS, MCP_SERVER_NAMES, type McpServerName } from './servers';

/**
 * Loads the platform's MCP tools as LangChain tools for a graph node to bind.
 *
 * Transport is in-process: client and server are linked by `InMemoryTransport`, which is the
 * stdio-equivalent for a server we host ourselves (real MCP protocol, no child process, no build
 * step). External clients get the same servers over stdio (`src/mcp/bin/*.ts`) or Streamable HTTP
 * (`src/app/api/mcp/[server]/route.ts`).
 */

export interface McpToolset {
  tools: StructuredToolInterface[];
  /** Always call this when the node is done — each toolset holds three live client/server pairs. */
  close(): Promise<void>;
}

export interface McpScope {
  projectId: string;
  /** Defaults to asset + context. Generation tools are opt-in: a node must ask for them. */
  servers?: McpServerName[];
}

const DEFAULT_SERVERS: McpServerName[] = ['asset', 'context'];

async function connectInProcess(name: McpServerName): Promise<{ client: Client; close: () => Promise<void> }> {
  const server = MCP_SERVER_BUILDERS[name]();
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: `${name}-client`, version: '1.0.0' });

  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

  return {
    client,
    close: async () => {
      await client.close();
      await server.close();
    },
  };
}

export async function getMcpTools(scope: McpScope): Promise<McpToolset> {
  const names = scope.servers ?? DEFAULT_SERVERS;
  const connections = await Promise.all(names.map(async (name) => ({ name, ...(await connectInProcess(name)) })));

  try {
    const loaded = await Promise.all(
      connections.map((connection) => loadMcpTools(connection.name, connection.client, { throwOnLoadError: true })),
    );
    return {
      tools: bindProjectScope(loaded.flat(), { projectId: scope.projectId }),
      close: async () => {
        await Promise.all(connections.map((connection) => connection.close()));
      },
    };
  } catch (err) {
    await Promise.all(connections.map((connection) => connection.close()));
    throw err;
  }
}

export { MCP_SERVER_NAMES };
export type { McpServerName };
