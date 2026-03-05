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

  constructor(options: ApolloClient.Options) {
    const link = options.link ?? new ToolCallLink();

    if (__DEV__) {
      validateTerminatingLink(link);
    }

    super({
      ...options,
      link,
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

    this.manifest = options.manifest;
    this.appManager = new McpAppManager(this.manifest);
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
    const { structuredContent, toolName, args } =
      await this.appManager.connect();

    this.#toolInput = args;

    this.manifest.operations.forEach((operation) => {
      if (
        operation.prefetchID &&
        structuredContent.prefetch?.[operation.prefetchID]
      ) {
        this.writeQuery({
          query: parse(operation.body),
          data: structuredContent.prefetch[operation.prefetchID].data,
        });
      }

      if (operation.tools.find((tool) => tool.name === toolName)) {
        if (structuredContent.result?.data) {
          this.writeQuery({
            query: parse(operation.body),
            data: structuredContent.result.data,
            variables: getVariablesForOperationFromToolInput(operation, args),
          });
        }
      }
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
