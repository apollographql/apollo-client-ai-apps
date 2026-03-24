import type { ApolloLink } from "@apollo/client";
import { ApolloClient as BaseApolloClient } from "@apollo/client";
import { DocumentTransform } from "@apollo/client";
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
  getVariablesForOperationFromToolInput,
  promiseWithResolvers,
  warnOnVariableMismatch,
} from "../../utilities/index.js";
import { ToolHydrationLink } from "../../link/ToolHydrationLink.js";
import { McpAppManager } from "../../core/McpAppManager.js";
import { getVariableNamesFromDocument } from "../../utilities/getVariableNamesFromDocument.js";
import type { ApolloMcpServerApps } from "../../core/types.js";
import { connectToHost } from "../../core/connectToHost.js";

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
      const toolResult =
        promiseWithResolvers<ApolloMcpServerApps.CallToolResult>();

      app.ontoolresult = (params) => {
        toolResult.resolve(
          params as unknown as ApolloMcpServerApps.CallToolResult
        );
      };

      await connectToHost(app);

      // After a page refresh, OpenAI does not re-send `ui/notifications/tool-result`.
      // Instead, the tool result is available immediately via `window.openai.toolOutput`.
      // If it's already set, resolve the promise now rather than waiting for the
      // notification that will never arrive.
      if (window.openai.toolOutput !== null) {
        toolResult.resolve({
          structuredContent: window.openai.toolOutput,
          content: [],
        });
      }

      const { structuredContent } = await toolResult.promise;

      return {
        structuredContent: {
          ...structuredContent,
          ...(
            window.openai
              .toolResponseMetadata as ApolloMcpServerApps.Meta | null
          )?.structuredContent,
        },
        toolName: app.getHostContext()?.toolInfo?.tool.name,

        // OpenAI is not consistent about sending `ui/notifications/tool-input`.
        // Sometimes it doesn't send at all, other times it sends more than once
        // before we get the tool result (which should always happen and at most
        // once according to the spec). Rather than relying on the
        // `ui/notifications/tool-input` notification to set the tool input value,
        // we read from `window.openai.toolInput so that we have the most recent
        // set value.
        //
        // When OpenAI fixes this issue and sends `ui/notifications/tool-input`
        // consistently according to the MCP Apps specification, this can be
        // reverted to use the `app.ontoolinput` callback.
        toolInput: window.openai.toolInput,

        // OpenAI doesn't provide access to `_meta`, so we need to use
        // window.openai.toolResponseMetadata directly
        _meta: window.openai.toolResponseMetadata as
          | ApolloMcpServerApps.Meta
          | undefined,
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
