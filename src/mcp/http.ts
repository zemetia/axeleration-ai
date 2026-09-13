import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import type { JSONRPCMessage } from '@modelcontextprotocol/sdk/types.js';

import { MCP_SERVER_BUILDERS, type McpServerName } from './servers';

/**
 * Stateless Streamable-HTTP bridge: one fresh server instance per request, JSON responses only
 * (no SSE stream, no sessions). That covers `initialize` / `tools/list` / `tools/call`, which is
 * everything an external client needs here — the in-process path (`client.ts`) is what the
 * pipeline itself uses, so the HTTP surface stays deliberately small.
 */

export function isMcpHttpEnabled(): boolean {
  return process.env.MCP_TRANSPORT === 'http';
}

/** Reads the project a `tools/call` is aimed at, so the route can check ownership before running it. */
export function projectIdOf(message: JSONRPCMessage): string | null {
  if (!('method' in message) || message.method !== 'tools/call') return null;
  const params = message.params as { arguments?: Record<string, unknown> } | undefined;
  const projectId = params?.arguments?.projectId;
  return typeof projectId === 'string' ? projectId : null;
}

/** Forwards one JSON-RPC message to a server instance. Returns `null` for notifications (no reply). */
export async function dispatchJsonRpc(name: McpServerName, message: JSONRPCMessage): Promise<JSONRPCMessage | null> {
  const server = MCP_SERVER_BUILDERS[name]();
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

  try {
    await server.connect(serverTransport);

    const isRequest = 'id' in message && 'method' in message;
    const reply = new Promise<JSONRPCMessage>((resolve, reject) => {
      clientTransport.onmessage = resolve;
      clientTransport.onerror = reject;
    });

    await clientTransport.start();
    await clientTransport.send(message);

    return isRequest ? await reply : null;
  } finally {
    await clientTransport.close();
    await server.close();
  }
}
