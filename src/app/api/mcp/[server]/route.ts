import { NextResponse } from 'next/server';
import type { JSONRPCMessage } from '@modelcontextprotocol/sdk/types.js';

import { getSession } from '@/lib/auth';
import { dispatchJsonRpc, isMcpHttpEnabled, projectIdOf } from '@/mcp/http';
import { isMcpServerName } from '@/mcp/servers';
import { projectService } from '@/services';

/**
 * Streamable HTTP transport for external MCP clients — off unless `MCP_TRANSPORT=http`.
 * Every call is authenticated, and every `tools/call` is checked against the caller's ownership
 * of the `projectId` it names, so the HTTP surface can't reach another user's project.
 */

export const runtime = 'nodejs';

function rpcError(id: unknown, code: number, message: string, status: number) {
  return NextResponse.json({ jsonrpc: '2.0', id: id ?? null, error: { code, message } }, { status });
}

export async function POST(request: Request, { params }: { params: Promise<{ server: string }> }) {
  if (!isMcpHttpEnabled()) {
    return NextResponse.json({ error: 'MCP HTTP transport is disabled' }, { status: 404 });
  }

  const { server } = await params;
  if (!isMcpServerName(server)) {
    return NextResponse.json({ error: `Unknown MCP server "${server}"` }, { status: 404 });
  }

  const session = await getSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let message: JSONRPCMessage;
  try {
    message = (await request.json()) as JSONRPCMessage;
  } catch {
    return rpcError(null, -32700, 'Parse error', 400);
  }

  const id = 'id' in message ? message.id : null;
  const projectId = projectIdOf(message);
  if (projectId) {
    const ownerId = await projectService.ownerOf(projectId);
    if (ownerId !== session.user.id) {
      return rpcError(id, -32001, 'Forbidden: project not owned by caller', 403);
    }
  } else if ('method' in message && message.method === 'tools/call') {
    return rpcError(id, -32602, 'Missing projectId in tool arguments', 400);
  }

  const reply = await dispatchJsonRpc(server, message);
  return reply ? NextResponse.json(reply) : new NextResponse(null, { status: 202 });
}
