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
  #toolMetadata: Record<string, unknown> | null = null;
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

    this.app.ontoolresult = (params) => {
      toolResult.resolve(
        params as unknown as ApolloMcpServerApps.CallToolResult
      );
    };

    await this.connect();

    const { structuredContent } = await toolResult.promise;

    this.#toolName = this.app.getHostContext()?.toolInfo?.tool.name;

    // OpenAI is not consistent about sending `ui/notifications/tool-input`.
    // Sometimes it doesn't send at all, other times it sends more than once
    // before we get the tool result (which should always happen and at most
    // once according to the spec). Rather than relying on the
    // `ui/notifications/tool-input` notification to set the tool input value,
    // we read from `window.openai.toolInput so that we hvae the most recent
    // set value.
    //
    // When OpenAI fixes this issue and sends `ui/notifications/tool-input`
    // consistently according to the MCP Apps specification, this can be
    // reverrted to use the `app.ontoolinput` callback.
    this.#toolInput = window.openai.toolInput;

    // OpenAI doesn't provide access to `_meta`, so we need to use
    // window.openai.toolResponseMetadata directly
    this.#toolMetadata = window.openai.toolResponseMetadata;

    return {
      ...structuredContent,
      toolName: this.toolName,
      args: this.toolInput,
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
