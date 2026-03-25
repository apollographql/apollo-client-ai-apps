import {
  App,
  type McpUiHostContextChangedNotification,
} from "@modelcontextprotocol/ext-apps";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { ApplicationManifest } from "../types/application-manifest.js";
import type { FormattedExecutionResult } from "graphql";
import type { DocumentNode, OperationVariables } from "@apollo/client";
import { print } from "@apollo/client/utilities";
import { cacheAsync } from "../utilities/index.js";
import type { ApolloMcpServerApps } from "./types.js";

type ExecuteQueryCallToolResult = Omit<CallToolResult, "structuredContent"> & {
  structuredContent: FormattedExecutionResult;
  _meta?: { structuredContent?: FormattedExecutionResult };
};

interface ConnectToHostResult {
  structuredContent: ApolloMcpServerApps.StructuredContent;
  _meta: ApolloMcpServerApps.Meta | undefined;
  toolInput: Record<string, unknown> | undefined;
}

export type ConnectToHostImplementation = (
  app: App
) => Promise<ConnectToHostResult>;

/** @internal */
export class McpAppManager {
  readonly app: App;

  #toolName: string | undefined;
  #toolMetadata: ApolloMcpServerApps.CallToolResult["_meta"] | undefined;
  #toolInput: Record<string, unknown> | undefined;

  #connectToHost: ConnectToHostImplementation;

  #hostContextCallbacks = new Set<
    (params: McpUiHostContextChangedNotification["params"]) => void
  >();

  constructor(
    manifest: ApplicationManifest,
    connectToHost: ConnectToHostImplementation
  ) {
    this.app = new App({ name: manifest.name, version: manifest.appVersion });
    this.#connectToHost = connectToHost;
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
    this.app.onhostcontextchanged = (params) => {
      this.#hostContextCallbacks.forEach((cb) => cb(params));
    };

    const result = await this.#connectToHost(this.app);

    // Some hosts do not provide toolInfo in the ui/initialize response, so we
    // fallback to `_meta.toolName` provided by Apollo MCP server if the value
    // is not available.
    const toolName =
      this.app.getHostContext()?.toolInfo?.tool.name ??
      result._meta?.toolName ??
      // Some hosts do not forward `_meta` nor do they provide `toolInfo`. Our
      // MCP server provides `toolName` in `structuredContent` as a workaround
      // that we can use if all else fails
      result.structuredContent.toolName;

    const structuredContent = {
      ...result.structuredContent,
      ...result._meta?.structuredContent,
    };

    this.#toolName = toolName;
    this.#toolInput = result.toolInput;
    this.#toolMetadata = result._meta;

    return {
      ...result,
      toolName,
      structuredContent,
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
}
