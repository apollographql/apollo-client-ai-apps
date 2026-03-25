import type { McpUiHostContext } from "@modelcontextprotocol/ext-apps";
import type { AbstractApolloClient } from "../../../core/AbstractApolloClient";
import { minimalHostContextWithToolName } from "../mcp/minimalHostContextWithToolName";
import { mockMcpHost } from "../mcp/mockMcpHost";
import { stubOpenAiGlobals } from "../openai/stubOpenAiGlobals";
import type { ApolloMcpServerApps } from "../../../core/types";
import type { OpenAiGlobals } from "../../../openai/types";
export declare namespace createHostEnv {
  export namespace setupHost {
    export interface MockToolResult extends Pick<
      ApolloMcpServerApps.CallToolResult,
      "structuredContent" | "isError"
    > {
      _meta?: Omit<ApolloMcpServerApps.Meta, "toolName"> & {
        toolName?: string;
      };
    }

    export interface Options {
      client: AbstractApolloClient;
      hostContext?: McpUiHostContext;
      toolCall?: {
        name?: string;
        input?: Record<string, unknown>;
        result?: setupHost.MockToolResult;
      };
      openai?: {
        /**
         * When true, sets window.openai.toolOutput to toolCall.result.structuredContent.
         * Simulates the page-refresh scenario where ChatGPT does not re-send the
         * tool-result notification. Call host.sendToolInput(params.toolInput) but
         * omit host.sendToolResult() in the test.
         */
        toolOutput?: true;
      };
    }
  }
}

export function createHostEnv(hostEnv: "openai" | "mcp") {
  return async function setupHost(options: createHostEnv.setupHost.Options) {
    const { client, toolCall } = options;

    const toolName = toolCall?.name;
    const toolInput = toolCall?.input;

    const mockOptions: mockMcpHost.Options = {};

    const hostContext =
      toolName ?
        { ...minimalHostContextWithToolName(toolName), ...options.hostContext }
      : options.hostContext;

    if (hostContext) {
      mockOptions.hostContext = hostContext;
    }

    const toolResult =
      toolName ?
        {
          ...options.toolCall?.result,
          structuredContent: {
            ...options.toolCall?.result?.structuredContent,
            toolName,
          },
          _meta: { ...options.toolCall?.result?._meta, toolName },
        }
      : options.toolCall?.result;

    const host = await mockMcpHost(mockOptions);
    host.onCleanup(() => client.stop());

    const params = {
      toolInput: toolInput ? { arguments: toolInput } : {},
      toolResult: { ...toolResult },
    };

    if (hostEnv === "openai") {
      // OpenAI doesn't set _meta in the notification
      delete params.toolResult._meta;

      stubOpenAiGlobals((defaults) => {
        const globals: Partial<OpenAiGlobals> = { ...defaults };

        if (toolInput) {
          globals.toolInput = toolInput;
        }

        const _meta = toolResult?._meta;

        if (_meta) {
          globals.toolResponseMetadata = _meta;
        }

        if (options.openai?.toolOutput && toolResult?.structuredContent) {
          globals.toolOutput = toolResult.structuredContent;
        }

        return globals;
      });
    }

    return { host, params };
  };
}
