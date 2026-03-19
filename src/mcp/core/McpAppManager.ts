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
  #toolMetadata: ApolloMcpServerApps.CallToolResult["_meta"] | undefined;
  #toolInput: Record<string, unknown> | undefined;
  #toolResultPromise: Promise<ApolloMcpServerApps.CallToolResult> | undefined;

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

  get toolResultPromise(): Promise<ApolloMcpServerApps.CallToolResult> {
    if (!this.#toolResultPromise) {
      throw new Error(
        "toolResultPromise is not available before connect() is called"
      );
    }
    return this.#toolResultPromise;
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
    let toolInput = promiseWithResolvers<Parameters<App["ontoolinput"]>[0]>();

    this.app.ontoolresult = (params) => {
      toolResult.resolve(
        params as unknown as ApolloMcpServerApps.CallToolResult
      );
    };

    this.app.ontoolinput = (params) => {
      toolInput.resolve(params);
    };

    this.app.onhostcontextchanged = (params) => {
      this.#hostContextCallbacks.forEach((cb) => cb(params));
    };

    await this.connectToHost();

    // Store the tool result promise for async consumption by ApolloClient.
    // We don't await it here — the HydrationLink holds queries until it resolves.
    this.#toolResultPromise = toolResult.promise;

    // Set toolMetadata and toolName fallbacks when the tool result resolves.
    // This runs before ApolloClient's toolResultPromise.then() handler since
    // this .then() is attached first, ensuring metadata is available before
    // HydrationLink unblocks and components re-render.
    toolResult.promise.then(({ structuredContent, _meta }) => {
      this.#toolMetadata = _meta;
      // Some hosts do not provide toolInfo in the ui/initialize response, so we
      // fallback to `_meta.toolName` provided by Apollo MCP server if the value
      // is not available.
      this.#toolName ??=
        _meta?.toolName ??
        // Some hosts do not forward `_meta` nor do they provide `toolInfo`. Our
        // MCP server provides `toolName` in `structuredContent` as a workaround
        // that we can use if all else fails
        structuredContent.toolName;
    });

    const { arguments: args } = await toolInput.promise;

    this.#toolName = this.app.getHostContext()?.toolInfo?.tool.name;
    this.#toolInput = args;
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
