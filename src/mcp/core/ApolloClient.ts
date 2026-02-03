import { ApolloLink } from "@apollo/client";
import { ApolloClient as BaseApolloClient } from "@apollo/client";
import { DocumentTransform } from "@apollo/client";
import { removeDirectivesFromDocument } from "@apollo/client/utilities/internal";
import { parse } from "graphql";
import { __DEV__ } from "@apollo/client/utilities/environment";
import type { ApplicationManifest } from "../../types/application-manifest.js";
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
    const {
      result,
      toolName,
      variables: toolVariables,
    } = await this.appManager.waitForInitialization();

    this.manifest.operations.forEach((operation) => {
      if (operation.prefetchID && result.prefetch?.[operation.prefetchID]) {
        this.writeQuery({
          query: parse(operation.body),
          data: result.prefetch[operation.prefetchID].data,
        });
      }

      if (operation.tools.find((tool) => tool.name === toolName)) {
        const variables =
          toolVariables ?
            Object.keys(toolVariables ?? {}).reduce(
              (obj, key) =>
                operation.variables?.[key] ?
                  { ...obj, [key]: toolVariables[key] }
                : obj,
              {}
            )
          : {};

        this.writeQuery({
          query: parse(operation.body),
          data: result.result.data,
          variables,
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

  if (terminatingLink.constructor.name !== "ToolCallLink") {
    throw new Error(
      "The terminating link must be a `ToolCallLink`. If you are using a `split` link, ensure the `right` branch uses a `ToolCallLink` as the terminating link."
    );
  }
}
