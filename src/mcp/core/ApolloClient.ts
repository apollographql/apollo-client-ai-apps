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
import { ToolCallLink } from "../link/ToolCallLink.js";
import {
  aiClientSymbol,
  cacheAsync,
  getToolNamesFromDocument,
  getVariableNamesFromDocument,
  getVariablesForOperationFromToolInput,
  warnOnVariableMismatch,
} from "../../utilities/index.js";
import { ToolHydrationLink } from "../../link/ToolHydrationLink.js";
import type { HydrationData } from "../../link/ToolHydrationLink.js";
import { McpAppManager } from "./McpAppManager.js";

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
    this.appManager = new McpAppManager(this.manifest);
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
    // Blocks on MCP handshake + tool input only (not tool result).
    // Suspense releases here, allowing the app to render with toolInput/toolName.
    await this.appManager.connect();

    this.#toolInput = this.appManager.toolInput;

    // When the tool result arrives asynchronously, write to cache and unblock
    // HydrationLink so any pending queries (including network-only/cache-and-network)
    // are served from tool result data rather than triggering a real tool call.
    this.appManager.toolResultPromise.then(({ structuredContent, _meta }) => {
      const toolName =
        this.appManager.toolName ??
        _meta?.toolName ??
        structuredContent.toolName;
      const args = this.appManager.toolInput!;
      const hydrations: HydrationData[] = [];

      this.manifest.operations.forEach((operation) => {
        if (
          operation.prefetchID &&
          structuredContent.prefetch?.[operation.prefetchID]
        ) {
          const data = structuredContent.prefetch[operation.prefetchID]
            .data as Record<string, unknown>;
          this.writeQuery({ query: parse(operation.body), data });
        }

        if (operation.tools.find((tool) => tool.name === toolName)) {
          if (structuredContent.result?.data) {
            const variables = getVariablesForOperationFromToolInput(
              operation,
              args
            );
            const result = structuredContent.result;
            this.writeQuery({
              query: parse(operation.body),
              data: result.data,
              variables,
            });

            hydrations.push({
              operationName: operation.name,
              result,
              variables,
            });
          }
        }
      });

      this.#toolHydrationLink.complete(hydrations);
    });
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
