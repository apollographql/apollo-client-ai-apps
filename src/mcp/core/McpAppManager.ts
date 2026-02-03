import { App, PostMessageTransport } from "@modelcontextprotocol/ext-apps";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { ApplicationManifest } from "../../types/application-manifest";
import type { FormattedExecutionResult } from "graphql";
import type { DocumentNode, OperationVariables } from "@apollo/client";
import { print } from "@apollo/client/utilities";
import { cacheAsync } from "../../utilities";
import type { ApolloMcpServerApps } from "../../core/types";

type ExecuteQueryCallToolResult = Omit<CallToolResult, "structuredContent"> & {
  structuredContent: FormattedExecutionResult;
};

export class McpAppManager {
  readonly app: App;

  private _toolName!: string;
  private _toolMetadata: Record<string, unknown> = {};

  constructor(manifest: ApplicationManifest) {
    // TODO: Determine how we want to provide this version long-term.
    this.app = new App({ name: manifest.name, version: "1.0.0" });
  }

  get toolName() {
    return this._toolName;
  }

  get toolMetadata() {
    return this._toolMetadata;
  }

  waitForInitialization = cacheAsync(async () => {
    let toolResult!: ApolloMcpServerApps.CallToolResult;
    let toolInput!: Parameters<App["ontoolinput"]>[0];

    this.app.ontoolresult = (params) => {
      toolResult = params as unknown as ApolloMcpServerApps.CallToolResult;
    };

    this.app.ontoolinput = (params) => {
      toolInput = params;
    };

    await this.connect();

    const { structuredContent, _meta } = toolResult;

    this._toolName = _meta.toolName;
    this._toolMetadata = _meta;

    return {
      ...structuredContent,
      toolName: _meta.toolName,
      variables: toolInput.arguments as OperationVariables | undefined,
    };
  });

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

  private connect() {
    try {
      return this.app.connect(
        new PostMessageTransport(window.parent, window.parent)
      );
    } catch (e) {
      const error = e instanceof Error ? e : new Error("Failed to connect");

      throw error;
    }
  }
}
