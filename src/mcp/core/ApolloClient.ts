import { ApolloLink } from "@apollo/client";
import { ApolloClient as BaseApolloClient } from "@apollo/client";
import { DocumentTransform } from "@apollo/client";
import { removeDirectivesFromDocument } from "@apollo/client/utilities/internal";
import { parse } from "graphql";
import { __DEV__ } from "@apollo/client/utilities/environment";
import type { ApplicationManifest } from "../../types/application-manifest.js";
import { ToolCallLink } from "../link/ToolCallLink.js";
import { aiClientSymbol, cacheAsync } from "../../utilities/index.js";
import { McpApp } from "./McpApp.js";
import type { ApolloMcpServerApps } from "../../core/types.js";

export declare namespace ApolloClient {
  // This allows us to extend the options with the "manifest" option AND make link optional (it is normally required)
  export interface Options extends Omit<BaseApolloClient.Options, "link"> {
    link?: BaseApolloClient.Options["link"];
    manifest: ApplicationManifest;
  }
}

export class ApolloClient extends BaseApolloClient {
  manifest: ApplicationManifest;
  readonly app: McpApp;

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
    this.app = new McpApp(this.manifest);
  }

  waitForInitialization = cacheAsync(async () => {
    await this.app.connect();

    const waitForToolResult =
      async (): Promise<ApolloMcpServerApps.CallToolResult> => {
        if (this.app.toolResult) {
          return Promise.resolve(
            this.app.toolResult as unknown as ApolloMcpServerApps.CallToolResult
          );
        }

        return new Promise((resolve) => {
          const unsubscribe = this.app.onChange("toolResult", (result) => {
            resolve(result as unknown as ApolloMcpServerApps.CallToolResult);
            unsubscribe();
          });
        });
      };

    const toolResult = await waitForToolResult();

    if (!toolResult) {
      return;
    }

    const { _meta: meta, structuredContent } = toolResult;

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

      if (
        operation.tools.find(
          (tool) => `${this.manifest.name}--${tool.name}` === meta.toolName
        )
      ) {
        const variables =
          this.app.toolInput ?
            Object.keys(this.app.toolInput.arguments ?? {}).reduce(
              (obj, key) =>
                operation.variables?.[key] ?
                  { ...obj, [key]: this.app.toolInput?.arguments?.[key] }
                : obj,
              {}
            )
          : {};

        this.writeQuery({
          query: parse(operation.body),
          data: structuredContent.result.data,
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
