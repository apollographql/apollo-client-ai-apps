import type {
  McpUiHostContext,
  McpUiToolInputNotification,
} from "@modelcontextprotocol/ext-apps";
import type { AbstractApolloClient } from "../../../core/AbstractApolloClient";
import { mockMcpHost } from "../mcp/mockMcpHost";
import { stubOpenAiGlobals } from "../openai/stubOpenAiGlobals";
import type { ApolloMcpServerApps } from "../../../core/types";
import type { OpenAiGlobals } from "../../../openai/types";
import { invariant } from "@apollo/client/utilities/invariant";

export declare namespace createHostEnv {
  export namespace setupHost {
    export type MockToolResult = Pick<
      ApolloMcpServerApps.CallToolResult,
      "structuredContent" | "_meta" | "isError"
    >;

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
      hostContext,
      toolInput,
      toolResult,
      customizeOpenAiGlobals,
    } = options;

    const mockOptions: mockMcpHost.Options = {};

    if (hostContext) {
      mockOptions.hostContext = hostContext;
    }

    const host = await mockMcpHost(mockOptions);
    host.onCleanup(() => client.stop());

    const params = {
      toolInput: toolInput ? { arguments: toolInput } : {},
      toolResult: { ...toolResult },
    };

    if (toolInput) {
      params.toolInput.arguments = toolInput;
    }

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
