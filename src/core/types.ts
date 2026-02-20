import type { CallToolResult as McpCallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { FormattedExecutionResult } from "graphql";

export namespace ApolloMcpServerApps {
  export interface Meta {
    toolName: string;
    [x: string]: unknown;
  }

  export interface StructuredContent {
    result: FormattedExecutionResult;
    prefetch?: Record<string, FormattedExecutionResult>;
    [x: string]: unknown;
  }

  export interface CallToolResult extends McpCallToolResult {
    _meta: ApolloMcpServerApps.Meta;
    structuredContent: ApolloMcpServerApps.StructuredContent;
  }
}
