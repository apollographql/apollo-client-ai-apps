import type { CallToolResult as McpCallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { FormattedExecutionResult } from "graphql";

export namespace ApolloMcpServerApps {
  export interface Meta {
    toolName: string;
    structuredContent?: ApolloMcpServerApps.StructuredContent;
    [x: string]: unknown;
  }

  export interface StructuredContent {
    result?: FormattedExecutionResult;
    prefetch?: Record<string, FormattedExecutionResult>;
    toolName?: string;
    [x: string]: unknown;
  }

  export interface CallToolResult extends McpCallToolResult {
    _meta?: ApolloMcpServerApps.Meta;
    structuredContent: ApolloMcpServerApps.StructuredContent;
  }
}
