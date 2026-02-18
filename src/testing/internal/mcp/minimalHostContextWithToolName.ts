import type { McpUiHostContext } from "@modelcontextprotocol/ext-apps";

export function minimalHostContextWithToolName(
  toolName: string
): McpUiHostContext {
  return {
    toolInfo: { tool: { name: toolName, inputSchema: { type: "object" } } },
  };
}
