import type { McpUiToolResultNotification } from "@modelcontextprotocol/ext-apps";
import type { FormattedExecutionResult } from "graphql";
import type { ApolloMcpServerApps } from "../../../core/types";

export function graphqlToolResult<TData = Record<string, unknown>>(
  options:
    | FormattedExecutionResult<TData>
    | {
        prefetch?: Record<string, FormattedExecutionResult>;
        result: FormattedExecutionResult<TData>;
      }
): McpUiToolResultNotification["params"] {
  let structuredContent: ApolloMcpServerApps.StructuredContent;

  if ("data" in options) {
    structuredContent = { result: options as FormattedExecutionResult };
  } else if ("result" in options) {
    structuredContent = { result: options.result as FormattedExecutionResult };

    if (options.prefetch) {
      structuredContent.prefetch = options.prefetch;
    }
  } else {
    throw new Error("Mock tool result could not be parsed");
  }

  return {
    content: [{ type: "text", text: JSON.stringify(structuredContent) }],
    structuredContent,
  };
}
