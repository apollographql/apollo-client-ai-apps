import type { ApolloLink } from "@apollo/client";
import { ApolloClient as BaseApolloClient } from "@apollo/client";
import { DocumentTransform } from "@apollo/client";
import { removeDirectivesFromDocument } from "@apollo/client/utilities/internal";
import { parse } from "graphql";
import { __DEV__ } from "@apollo/client/utilities/environment";
import "../types/openai.js";
import type { ApplicationManifest } from "../types/application-manifest.js";
import { ToolCallLink } from "../link/ToolCallLink.js";
import type { FetchResult } from "@apollo/client";

// TODO: In the future if/when we support PQs again, do pqLink.concat(toolCallLink)
// Commenting this out for now.
//  import { sha256 } from "crypto-hash";
// import { PersistedQueryLink } from "@apollo/client/link/persisted-queries";
// const pqLink = new PersistedQueryLink({
//   sha256: (queryString) => sha256(queryString),
// });

export declare namespace ApolloClient {
  // This allows us to extend the options with the "manifest" option AND make link optional (it is normally required)
  export interface Options extends Omit<BaseApolloClient.Options, "link"> {
    link?: BaseApolloClient.Options["link"];
    manifest: ApplicationManifest;
  }
}

export class ApolloClient extends BaseApolloClient {
  manifest: ApplicationManifest;

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

  async prefetchData() {
    const toolOutput = window.openai.toolOutput as {
      prefetch?: Record<string, FetchResult<any>>;
    } | null;

    // Write prefetched data to the cache
    this.manifest.operations.forEach((operation) => {
      if (
        operation.prefetch &&
        operation.prefetchID &&
        toolOutput?.prefetch?.[operation.prefetchID]
      ) {
        this.writeQuery({
          query: parse(operation.body),
          data: toolOutput.prefetch[operation.prefetchID].data,
        });
      }

      // If this operation has the tool that matches up with the tool that was executed, write the tool result to the cache
      if (
        operation.tools?.find(
          (tool) =>
            `${this.manifest.name}--${tool.name}` ===
            window.openai.toolResponseMetadata?.toolName
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
  }
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
