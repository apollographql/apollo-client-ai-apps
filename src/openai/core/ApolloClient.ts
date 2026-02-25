import type { ApolloLink } from "@apollo/client";
import { ApolloClient as BaseApolloClient } from "@apollo/client";
import { DocumentTransform } from "@apollo/client";
import type {
  WatchQueryOptions,
  ObservableQuery,
  OperationVariables,
} from "@apollo/client";
import {
  removeDirectivesFromDocument,
  getOperationDefinition,
} from "@apollo/client/utilities/internal";
import { Kind, parse } from "graphql";
import { equal } from "@wry/equality";
import { __DEV__ } from "@apollo/client/utilities/environment";
import type { ApplicationManifest } from "../../types/application-manifest.js";
import { ToolCallLink } from "../link/ToolCallLink.js";
import {
  aiClientSymbol,
  cacheAsync,
  getVariablesForOperationFromToolInput,
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
        return removeDirectivesFromDocument(
          [{ name: "prefetch" }, { name: "tool" }],
          document
        )!;
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
        const operationDef = getOperationDefinition(options.query);
        const hasMatchingTool = operationDef?.directives?.some((d) => {
          if (d.name.value !== "tool") return false;
          const nameArg = d.arguments?.find((arg) => arg.name.value === "name");
          return (
            nameArg?.value.kind === Kind.STRING &&
            nameArg.value.value === toolName
          );
        });

        if (hasMatchingTool) {
          // Clear after first matching comparison so this only fires once and
          // remounting doesn't produce spurious warnings.
          this.#toolInput = undefined;

          const variables = (options.variables ?? {}) as Record<
            string,
            unknown
          >;
          const hasToolInputMismatch = Object.entries(toolInput).some(
            ([key, value]) => !equal(variables[key], value)
          );

          if (hasToolInputMismatch) {
            console.warn(
              "This query has a @tool directive matching the current tool call, but the " +
                "variables passed to watchQuery don't match the tool input. Use " +
                "`useHydratedVariables` to automatically use the tool input as the initial variables."
            );
          }
        }
      }
    }

    return super.watchQuery(options);
  }

  connect = cacheAsync(async () => {
    const { prefetch, result, toolName, args } =
      await this.appManager.connect();

    this.#toolInput = args;

    this.manifest.operations.forEach((operation) => {
      if (operation.prefetchID && prefetch?.[operation.prefetchID]) {
        this.writeQuery({
          query: parse(operation.body),
          data: prefetch[operation.prefetchID].data,
        });
      }

      if (operation.tools.find((tool) => tool.name === toolName)) {
        this.writeQuery({
          query: parse(operation.body),
          data: result.data,
          variables: getVariablesForOperationFromToolInput(operation, args),
        });
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
