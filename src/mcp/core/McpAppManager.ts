import { App, PostMessageTransport } from "@modelcontextprotocol/ext-apps";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { ApplicationManifest } from "../../types/application-manifest";
import type { FormattedExecutionResult } from "graphql";
import type { DocumentNode, OperationVariables } from "@apollo/client";
import { print } from "@apollo/client/utilities";
import { cacheAsync, promiseWithResolvers } from "../../utilities";
import type { ApolloMcpServerApps } from "../../core/types";

type ExecuteQueryCallToolResult = Omit<CallToolResult, "structuredContent"> & {
  structuredContent: FormattedExecutionResult;
};

/** @internal */
export class McpAppManager {
  readonly app: App;

  #toolName: string | undefined;
  #toolMetadata: ApolloMcpServerApps.CallToolResult["_meta"] | undefined;
  #toolInput: Record<string, unknown> | undefined;

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

  waitForInitialization = cacheAsync(async () => {
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

    await this.connect();

    const { structuredContent, _meta } = await toolResult.promise;
    const { arguments: args } = await toolInput.promise;

    // Some hosts do not provide toolInfo in the ui/initialize response, so we
    // fallback to `_meta.toolName` provided by Apollo MCP server if the value
    // is not available.
    this.#toolName =
      this.app.getHostContext()?.toolInfo?.tool.name ?? _meta.toolName;
    this.#toolMetadata = _meta;
    this.#toolInput = args;

    return {
      ...structuredContent,
      toolName: this.toolName,
      args,
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

    return result.structuredContent;
  }

  private async connect() {
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
