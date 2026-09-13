import { tool } from '@langchain/core/tools';
import type { StructuredToolInterface } from '@langchain/core/tools';
import { z } from 'zod';

import { MCP_TOOL_SHAPES, type McpToolName } from './tools';

/**
 * Security boundary for the LangChain bridge: `projectId` is stripped from the schema the model
 * sees and re-injected server-side on every call, so a prompt-injected instruction inside a scene
 * description can never make a tool read another project's assets.
 */

function isMcpToolName(name: string): name is McpToolName {
  return name in MCP_TOOL_SHAPES;
}

/** The same shape as the MCP tool, minus the field the caller is not allowed to choose. */
function publicSchemaFor(name: McpToolName): z.ZodObject<Record<string, z.ZodType>> {
  const shape = MCP_TOOL_SHAPES[name] as Record<string, z.ZodType>;
  const rest: Record<string, z.ZodType> = {};
  for (const [key, schema] of Object.entries(shape)) {
    if (key !== 'projectId') rest[key] = schema;
  }
  return z.object(rest);
}

export function bindProjectScope(tools: StructuredToolInterface[], scope: { projectId: string }): StructuredToolInterface[] {
  return tools.map((mcpTool) => {
    if (!isMcpToolName(mcpTool.name)) {
      throw new Error(`Refusing to expose unscoped MCP tool "${mcpTool.name}" — it has no schema in MCP_TOOL_SHAPES`);
    }

    return tool(
      async (input: Record<string, unknown>) => {
        const output = await mcpTool.invoke({ ...input, projectId: scope.projectId });
        return typeof output === 'string' ? output : JSON.stringify(output);
      },
      {
        name: mcpTool.name,
        description: mcpTool.description,
        schema: publicSchemaFor(mcpTool.name),
      },
    );
  });
}
