import type {
  McpUiHostContext,
  McpUiToolInputNotification,
  McpUiToolResultNotification,
} from "@modelcontextprotocol/ext-apps";
import type { AbstractApolloClient } from "../../../core/AbstractApolloClient";
import { mockMcpHost } from "../mcp/mockMcpHost";
import { stubOpenAiGlobals } from "../openai/stubOpenAiGlobals";
import type { ApolloMcpServerApps } from "../../../core/types";
import type { OpenAiGlobals } from "../../../openai/types";
import { invariant } from "@apollo/client/utilities/invariant";

export declare namespace createHostEnv {
  export namespace setupHost {
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
      structuredContent?: ApolloMcpServerApps.StructuredContent;
      _meta?: ApolloMcpServerApps.Meta;
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
      structuredContent,
      _meta,
    } = options;

    if (hostEnv === "openai") {
      stubOpenAiGlobals((defaults) => {
        const globals: Partial<OpenAiGlobals> = { ...defaults };

        if (toolInput) {
          globals.toolInput = toolInput;
        }

        if (structuredContent) {
          globals.toolOutput = structuredContent;
        }

        if (_meta) {
          globals.toolResponseMetadata = _meta;
        }

        return globals;
      });
    }

    const mockOptions: mockMcpHost.Options = {};

    if (hostContext) {
      mockOptions.hostContext = hostContext;
    }

    const host = await mockMcpHost(mockOptions);
    host.onCleanup(() => client.stop());

    const params = {
      toolInput: {} as McpUiToolInputNotification["params"],
      toolResult: {} as Partial<McpUiToolResultNotification["params"]>,
    };

    if (toolInput) {
      params.toolInput.arguments = toolInput;
    }

    if (structuredContent) {
      params.toolResult.structuredContent = structuredContent;
    }

    // OpenAI doesn't set _meta in the notification
    if (hostEnv === "mcp" && _meta) {
      params.toolResult._meta = _meta;
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
