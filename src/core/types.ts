import type { CallToolResult as McpCallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { FormattedExecutionResult } from "graphql";

export namespace ApolloMcpServerApps {
  export interface StructuredContent {
    result: FormattedExecutionResult;
    prefetch?: Record<string, FormattedExecutionResult>;
    [x: string]: unknown;
  }

  export interface CallToolResult extends Omit<
    McpCallToolResult,
    "structuredContent"
  > {
    structuredContent: ApolloMcpServerApps.StructuredContent;
  }
}
