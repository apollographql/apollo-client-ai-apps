import type { OperationVariables } from "@apollo/client";
import {
  ApolloLink,
  ApolloClient as BaseApolloClient,
  DocumentTransform,
} from "@apollo/client";
import { removeDirectivesFromDocument } from "@apollo/client/utilities/internal";
import { parse } from "graphql";
import { __DEV__ } from "@apollo/client/utilities/environment";
import type {
  ApplicationManifest,
  ManifestOperation,
} from "../../types/application-manifest.js";
import { ToolCallLink } from "../link/ToolCallLink.js";
import { aiClientSymbol, cacheAsync } from "../../utilities/index.js";
import { McpAppManager } from "./McpAppManager.js";

export declare namespace ApolloClient {
  // This allows us to extend the options with the "manifest" option AND make link optional (it is normally required)
  export interface Options extends Omit<BaseApolloClient.Options, "link"> {
    link?: BaseApolloClient.Options["link"];
    manifest: ApplicationManifest;
  }
}

export class ApolloClient extends BaseApolloClient {
  manifest: ApplicationManifest;
  readonly appManager: McpAppManager;

  /**
   * @internal
   * @deprecated For internal use. Do not use directly.
   */
  readonly info = aiClientSymbol;

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
      }),
    });

    this.manifest = options.manifest;
    this.appManager = new McpAppManager(this.manifest);
  }

  waitForInitialization = cacheAsync(async () => {
    const { prefetch, result, toolName, variables } =
      await this.appManager.waitForInitialization();

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
          variables: getVariablesFromTool(operation, variables),
        });
      }
    });
  });
}

function getVariablesFromTool(
  operation: ManifestOperation,
  toolVariables: OperationVariables | undefined
): OperationVariables {
  if (!operation.variables || !toolVariables) {
    return {};
  }

  const variableNames = new Set(Object.keys(operation.variables));

  return Object.keys(toolVariables).reduce((obj, key) => {
    if (variableNames.has(key)) {
      obj[key] = toolVariables[key];
    }

    return obj;
  }, {} as OperationVariables);
}

function validateTerminatingLink(link: ApolloLink) {
  let terminatingLink = link;

  while (terminatingLink.right) {
    terminatingLink = terminatingLink.right;
  }

  if (terminatingLink.constructor.name !== "ToolCallLink") {
    throw new Error(
      "The terminating link must be a `ToolCallLink`. If you are using a `split` link, ensure the `right` branch uses a `ToolCallLink` as the terminating link."
    );
  }
}
