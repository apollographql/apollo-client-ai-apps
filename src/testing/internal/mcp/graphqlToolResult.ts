import type { McpUiToolResultNotification } from "@modelcontextprotocol/ext-apps";
import type { FormattedExecutionResult } from "graphql";
import type { ApolloMcpServerApps } from "../../../core/types";

export function graphqlToolResult(
  options:
    | FormattedExecutionResult
    | {
        prefetch?: Record<string, FormattedExecutionResult>;
        result: FormattedExecutionResult;
      }
): McpUiToolResultNotification["params"] {
  let structuredContent: ApolloMcpServerApps.StructuredContent;

  if ("data" in options) {
    structuredContent = { result: options };
  } else if ("result" in options) {
    structuredContent = { result: options.result };

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
