import type { ApolloLink } from "@apollo/client";
import { ApolloClient as BaseApolloClient } from "@apollo/client";
import { DocumentTransform } from "@apollo/client";
import { removeDirectivesFromDocument } from "@apollo/client/utilities/internal";
import { parse } from "graphql";
import { __DEV__ } from "@apollo/client/utilities/environment";
import type { ApplicationManifest } from "../../types/application-manifest.js";
import { SET_GLOBALS_EVENT_TYPE } from "../types.js";
import { ToolCallLink } from "../link/ToolCallLink.js";
import { aiClientSymbol, cacheAsync } from "../../utilities/index.js";
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
  }

  waitForInitialization = cacheAsync(async () => {
    const toolOutput = await waitForToolOutput();

    if (!toolOutput) {
      return;
    }

    // Write prefetched data to the cache
    this.manifest.operations.forEach((operation) => {
      if (operation.prefetchID && toolOutput.prefetch?.[operation.prefetchID]) {
        this.writeQuery({
          query: parse(operation.body),
          data: toolOutput.prefetch[operation.prefetchID].data,
        });
      }

      // If this operation has the tool that matches up with the tool that was executed, write the tool result to the cache
      if (
        operation.tools?.find(
          (tool) => tool.name === window.openai.toolResponseMetadata?.toolName
        )
      ) {
        // We need to include the variables that were used as part of the tool call so that we get a proper cache entry
        // However, we only want to include toolInput's that were graphql operation (ignore extraInputs)
        const variables = Object.keys(window.openai.toolInput).reduce(
          (obj, key) =>
            operation.variables?.[key] ?
              { ...obj, [key]: window.openai.toolInput[key] }
            : obj,
          {}
        );

        if (window.openai.toolOutput) {
          this.writeQuery({
            query: parse(operation.body),
            data: (window.openai.toolOutput.result as any).data,
            variables,
          });
        }
      }
    });
  });
}

async function waitForToolOutput(): Promise<ApolloMcpServerApps.StructuredContent | null> {
  if (window.openai?.toolOutput !== undefined) {
    return window.openai.toolOutput;
  }

  return new Promise((resolve) => {
    const controller = new AbortController();

    window.addEventListener(
      SET_GLOBALS_EVENT_TYPE,
      (event) => {
        if ("toolOutput" in event.detail.globals) {
          resolve(event.detail.globals.toolOutput ?? null);
          controller.abort();
        }
      },
      {
        passive: true,
        signal: controller.signal,
      }
    );
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
