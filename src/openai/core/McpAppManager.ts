import {
  App,
  PostMessageTransport,
  type McpUiHostContextChangedNotification,
} from "@modelcontextprotocol/ext-apps";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { ApplicationManifest } from "../../types/application-manifest";
import type { FormattedExecutionResult } from "graphql";
import type { DocumentNode, OperationVariables } from "@apollo/client";
import { print } from "@apollo/client/utilities";
import { cacheAsync, promiseWithResolvers } from "../../utilities";
import type { ApolloMcpServerApps } from "../../core/types";

type ExecuteQueryCallToolResult = Omit<CallToolResult, "structuredContent"> & {
  structuredContent: FormattedExecutionResult;
  _meta?: { structuredContent?: FormattedExecutionResult };
};

/** @internal */
export class McpAppManager {
  readonly app: App;

  #toolName: string | undefined;
  #toolMetadata: Record<string, unknown> | null = null;
  #toolInput: Record<string, unknown> | undefined;

  #hostContextCallbacks = new Set<
    (params: McpUiHostContextChangedNotification["params"]) => void
  >();

  constructor(manifest: ApplicationManifest) {
    this.app = new App({ name: manifest.name, version: manifest.appVersion });
  }

  get toolName() {
    return this.#toolName;
  }

  get toolMetadata() {
    return this.#toolMetadata;
  }

  get toolInput() {
    return this.#toolInput;
  }

  onHostContextChanged(
    cb: (params: McpUiHostContextChangedNotification["params"]) => void
  ) {
    this.#hostContextCallbacks.add(cb);
    return () => {
      this.#hostContextCallbacks.delete(cb);
    };
  }

  connect = cacheAsync(async () => {
    let toolResult = promiseWithResolvers<ApolloMcpServerApps.CallToolResult>();

    this.app.ontoolresult = (params) => {
      toolResult.resolve(
        params as unknown as ApolloMcpServerApps.CallToolResult
      );
    };

    this.app.onhostcontextchanged = (params) => {
      this.#hostContextCallbacks.forEach((cb) => cb(params));
    };

    await this.connectToHost();

    // After a page refresh, OpenAI does not re-send `ui/notifications/tool-result`.
    // Instead, the tool result is available immediately via `window.openai.toolOutput`.
    // If it's already set, resolve the promise now rather than waiting for the
    // notification that will never arrive.
    if (window.openai.toolOutput !== null) {
      toolResult.resolve({
        structuredContent: window.openai.toolOutput,
        content: [],
      });
    }

    const { structuredContent } = await toolResult.promise;

    this.#toolName = this.app.getHostContext()?.toolInfo?.tool.name;

    // OpenAI is not consistent about sending `ui/notifications/tool-input`.
    // Sometimes it doesn't send at all, other times it sends more than once
    // before we get the tool result (which should always happen and at most
    // once according to the spec). Rather than relying on the
    // `ui/notifications/tool-input` notification to set the tool input value,
    // we read from `window.openai.toolInput so that we have the most recent
    // set value.
    //
    // When OpenAI fixes this issue and sends `ui/notifications/tool-input`
    // consistently according to the MCP Apps specification, this can be
    // reverted to use the `app.ontoolinput` callback.
    this.#toolInput = window.openai.toolInput;

    // OpenAI doesn't provide access to `_meta`, so we need to use
    // window.openai.toolResponseMetadata directly
    this.#toolMetadata = window.openai.toolResponseMetadata;

    return {
      structuredContent: {
        ...structuredContent,
        ...(
          window.openai.toolResponseMetadata as ApolloMcpServerApps.Meta | null
        )?.structuredContent,
      },
      toolName: this.toolName,
      args: this.#toolInput,
    };
  });

  close() {
    return this.app.close();
  }

  async executeQuery({
    query,
    variables,
  }: {
    query: DocumentNode;
    variables: OperationVariables | undefined;
  }) {
    const result = (await this.app.callServerTool({
      name: "execute",
      arguments: { query: print(query), variables },
    })) as ExecuteQueryCallToolResult;

    return {
      ...result.structuredContent,
      ...result._meta?.structuredContent,
    };
  }

  private async connectToHost() {
    try {
      return await this.app.connect(
        new PostMessageTransport(window.parent, window.parent)
      );
    } catch (e) {
      const error = e instanceof Error ? e : new Error("Failed to connect");

      throw error;
    }
  }
}
