import {
  ApolloLink,
  ApolloClient as BaseApolloClient,
  DocumentTransform,
} from "@apollo/client";
import type {
  WatchQueryOptions,
  ObservableQuery,
  OperationVariables,
} from "@apollo/client";
import { removeDirectivesFromDocument } from "@apollo/client/utilities/internal";
import { parse, visit } from "graphql";
import { equal } from "@wry/equality";
import { __DEV__ } from "@apollo/client/utilities/environment";
import type { ApplicationManifest } from "../../types/application-manifest.js";
import { ToolCallLink } from "../../link/ToolCallLink.js";
import {
  aiClientSymbol,
  cacheAsync,
  connectToHost,
  getToolNamesFromDocument,
  getVariableNamesFromDocument,
  getVariablesForOperationFromToolInput,
  promiseWithResolvers,
  warnOnVariableMismatch,
} from "../../utilities/index.js";
import { ToolHydrationLink } from "../../link/ToolHydrationLink.js";
import { McpAppManager } from "../../core/McpAppManager.js";
import type { ApolloMcpServerApps } from "../../core/types.js";
import type { App } from "@modelcontextprotocol/ext-apps";

export declare namespace ApolloClient {
  export interface Options extends Omit<BaseApolloClient.Options, "link"> {
    link?: BaseApolloClient.Options["link"];
    manifest: ApplicationManifest;
  }
}

export class ApolloClient extends BaseApolloClient {
  manifest: ApplicationManifest;
  private readonly appManager: McpAppManager;

  /** @internal */
  readonly [aiClientSymbol] = true;

  #toolInput: Record<string, unknown> | undefined;
  #toolHydrationLink: ToolHydrationLink;

  constructor(options: ApolloClient.Options) {
    const toolHydrationLink = new ToolHydrationLink();
    const link = options.link ?? new ToolCallLink();

    if (__DEV__) {
      validateTerminatingLink(link);
    }

    super({
      ...options,
      link: toolHydrationLink.concat(link),
      // Strip out the prefetch/tool directives so they don't get sent with the operation to the server
      documentTransform: new DocumentTransform((document) => {
        const serverDocument = removeDirectivesFromDocument(
          [{ name: "prefetch" }, { name: "tool" }],
          document
        )!;

        return visit(serverDocument, {
          OperationDefinition(node) {
            return { ...node, description: undefined };
          },
        });
      }).concat(options.documentTransform ?? DocumentTransform.identity()),
    });

    this.#toolHydrationLink = toolHydrationLink;
    this.manifest = options.manifest;
    this.appManager = new McpAppManager(this.manifest, async (app) => {
      let toolResult =
        promiseWithResolvers<ApolloMcpServerApps.CallToolResult>();
      let toolInput = promiseWithResolvers<Parameters<App["ontoolinput"]>[0]>();

      app.ontoolresult = (params) => {
        toolResult.resolve(
          params as unknown as ApolloMcpServerApps.CallToolResult
        );
      };

      app.ontoolinput = (params) => {
        toolInput.resolve(params);
      };

      await connectToHost(app);

      const { structuredContent, _meta } = await toolResult.promise;
      const { arguments: args } = await toolInput.promise;

      // Some hosts do not provide toolInfo in the ui/initialize response, so we
      // fallback to `_meta.toolName` provided by Apollo MCP server if the value
      // is not available.
      const toolName =
        app.getHostContext()?.toolInfo?.tool.name ??
        _meta?.toolName ??
        // Some hosts do not forward `_meta` nor do they provide `toolInfo`. Our
        // MCP server provides `toolName` in `structuredContent` as a workaround
        // that we can use if all else fails
        structuredContent.toolName;

      return {
        structuredContent: {
          ...structuredContent,
          ..._meta?.structuredContent,
        },
        toolName,
        toolInput: args,
        _meta,
      };
    });
  }

  setLink(newLink: ApolloLink): void {
    super.setLink(this.#toolHydrationLink.concat(newLink));
  }

  stop() {
    super.stop();
    this.appManager.close().catch(() => {});
  }

  get toolInput() {
    return this.#toolInput;
  }

  clearToolInput() {
    this.#toolInput = undefined;
  }

  watchQuery<
    T = any,
    TVariables extends OperationVariables = OperationVariables,
  >(options: WatchQueryOptions<TVariables, T>): ObservableQuery<T, TVariables> {
    if (__DEV__) {
      const toolInput = this.#toolInput;

      if (toolInput) {
        const toolName = this.appManager.toolName;
        const hasMatchingTool =
          !!toolName && getToolNamesFromDocument(options.query).has(toolName);

        if (hasMatchingTool) {
          // Clear after first matching comparison so this only fires once and
          // remounting doesn't produce spurious warnings.
          this.#toolInput = undefined;

          const variableNames = getVariableNamesFromDocument(options.query);

          if (variableNames.size > 0) {
            const { variables } = options;
            const toolInputVariables = Object.entries(toolInput).filter(
              ([key]) => variableNames.has(key)
            );

            const hasToolInputMismatch = toolInputVariables.some(
              ([key, value]) => !equal(value, variables?.[key])
            );

            if (hasToolInputMismatch) {
              warnOnVariableMismatch(
                options.query,
                Object.fromEntries(toolInputVariables),
                variables
              );
            }
          }
        }
      }
    }

    return super.watchQuery(options);
  }

  connect = cacheAsync(async () => {
    const { structuredContent, toolName, toolInput } =
      await this.appManager.connect();

    this.#toolInput = toolInput;

    this.manifest.operations.forEach((operation) => {
      if (
        operation.prefetchID &&
        structuredContent.prefetch?.[operation.prefetchID]
      ) {
        this.writeQuery({
          query: parse(operation.body),
          data: structuredContent.prefetch[operation.prefetchID].data,
        });
        this.#toolHydrationLink.hydrate(operation, {
          result: structuredContent.prefetch[operation.prefetchID],
          variables: {},
        });
      }

      if (
        structuredContent.result &&
        operation.tools.find((tool) => tool.name === toolName)
      ) {
        this.#toolHydrationLink.hydrate(operation, {
          result: structuredContent.result,
          variables: getVariablesForOperationFromToolInput(
            operation,
            toolInput
          ),
        });
      }
    });

    this.#toolHydrationLink.complete();
  });
}

function validateTerminatingLink(link: ApolloLink) {
  let terminatingLink = link;

  while (terminatingLink.right) {
    terminatingLink = terminatingLink.right;
  }

  if (
    !isNamedLink(terminatingLink) ||
    terminatingLink.name !== "ToolCallLink"
  ) {
    throw new Error(
      "The terminating link must be a `ToolCallLink`. If you are using a `split` link, ensure the `right` branch uses a `ToolCallLink` as the terminating link."
    );
  }
}

function isNamedLink(link: ApolloLink): link is ApolloLink & { name: string } {
  return "name" in link;
}
