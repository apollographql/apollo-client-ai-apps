import type { CallToolResult as McpCallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { FormattedExecutionResult } from "graphql";

export namespace ApolloMcpServerApps {
  export interface Meta {
    toolName: string;
  }

  export interface StructuredContent {
    result: FormattedExecutionResult;
    prefetch?: Record<string, FormattedExecutionResult>;
  }

  export interface CallToolResult extends Omit<
    McpCallToolResult,
    "_meta" | "structuredContent"
  > {
    _meta: ApolloMcpServerApps.Meta;
    structuredContent: ApolloMcpServerApps.StructuredContent;
  }
}
