/** MCP tool results are content blocks; every tool here returns its payload as one JSON text block. */
export function jsonResult(payload: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(payload) }] };
}
