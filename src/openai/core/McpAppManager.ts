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
  #toolMetadata: Record<string, unknown> = {};

  constructor(manifest: ApplicationManifest) {
    this.app = new App({ name: manifest.name, version: manifest.appVersion });
  }

  get toolName() {
    return this.#toolName;
  }

  get toolMetadata() {
    return this.#toolMetadata;
  }

  waitForInitialization = cacheAsync(async () => {
    let toolResult = promiseWithResolvers<ApolloMcpServerApps.CallToolResult>();
    let toolInput = promiseWithResolvers<Parameters<App["ontoolinput"]>[0]>();

    this.app.ontoolresult = (params) => {
      toolResult.resolve(
        params as unknown as ApolloMcpServerApps.CallToolResult
      );

      // OpenAI is not consistent about sending `ui/notifications/tool-input`
      // before we get the rool result (which should happen according to the
      // spec). We resolve this promise in case it wasn't sent to avoid stalling
      // initialization indefinitely.
      //
      // When OpenAI fixes this issue and sends `ui/notifications/tool-input`
      // consistently, this can be removed.
      toolInput.resolve({});
    };

    this.app.ontoolinput = (params) => {
      toolInput.resolve(params);
    };

    await this.connect();

    const { structuredContent } = await toolResult.promise;
    const { arguments: args } = await toolInput.promise;

    this.#toolName = this.app.getHostContext()?.toolInfo?.tool.name;

    // OpenAI doesn't provide access to `_meta`, so we need to use
    // window.openai.toolResponseMetadata directly
    if (window.openai.toolResponseMetadata) {
      this.#toolMetadata = window.openai.toolResponseMetadata;
    }

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
