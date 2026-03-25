import type {
  McpUiHostContext,
  McpUiToolInputNotification,
} from "@modelcontextprotocol/ext-apps";
import type { AbstractApolloClient } from "../../../core/AbstractApolloClient";
import { minimalHostContextWithToolName } from "../mcp/minimalHostContextWithToolName";
import { mockMcpHost } from "../mcp/mockMcpHost";
import { stubOpenAiGlobals } from "../openai/stubOpenAiGlobals";
import type { ApolloMcpServerApps } from "../../../core/types";
import type { OpenAiGlobals } from "../../../openai/types";
import { invariant } from "@apollo/client/utilities/invariant";

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
      /**
       * Send the tool-input and tool-result notifications automatically.
       *
       * @default false
       */
      autoTriggerTool?: boolean;
      client: AbstractApolloClient;
      hostContext?: McpUiHostContext;
      toolInput?: Record<string, unknown>;
      toolName?: string;
      toolResult?: setupHost.MockToolResult;
      customizeOpenAiGlobals?: (
        globals: Partial<OpenAiGlobals>,
        options: {
          params: {
            toolInput: McpUiToolInputNotification["params"];
            toolResult: Partial<setupHost.MockToolResult>;
          };
        }
      ) => Partial<OpenAiGlobals>;
    }
  }
}

export function createHostEnv(hostEnv: "openai" | "mcp") {
  return async function setupHost(options: createHostEnv.setupHost.Options) {
    const {
      autoTriggerTool = false,
      client,
      toolInput,
      toolName,
      customizeOpenAiGlobals,
    } = options;

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
          ...options.toolResult,
          structuredContent: {
            ...options.toolResult?.structuredContent,
            toolName,
          },
          _meta: { ...options.toolResult?._meta, toolName },
        }
      : options.toolResult;

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

        return typeof customizeOpenAiGlobals === "function" ?
            customizeOpenAiGlobals(globals, { params })
          : globals;
      });
    }

    if (autoTriggerTool) {
      invariant(
        params.toolResult.structuredContent,
        "Must set structuredContent when autoTriggerTool is true"
      );

      host.sendToolInput(params.toolInput);
      host.sendToolResult(params.toolResult);
    }

    return { host, params };
  };
}
