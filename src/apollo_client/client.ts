import { ApolloClient, ApolloLink, InMemoryCache } from "@apollo/client";
import { from, map } from "rxjs";
import { selectHttpOptionsAndBody } from "@apollo/client/link/http";
import { fallbackHttpConfig } from "@apollo/client/link/http";
import { DocumentTransform } from "@apollo/client";
import { removeDirectivesFromDocument } from "@apollo/client/utilities/internal";
import { parse } from "graphql";
import "../types/openai";
import { ApplicationManifest } from "../types/application-manifest";

// TODO: In the future if/when we support PQs again, do pqLink.concat(toolCallLink)
// Commenting this out for now.
//  import { sha256 } from "crypto-hash";
// import { PersistedQueryLink } from "@apollo/client/link/persisted-queries";
// const pqLink = new PersistedQueryLink({
//   sha256: (queryString) => sha256(queryString),
// });

// Normally, ApolloClient uses an HttpLink and sends the graphql request over HTTP
// In our case, we're are sending the graphql request over the "execute" tool call
const toolCallLink = new ApolloLink((operation) => {
  const context = operation.getContext();
  const contextConfig = {
    http: context.http,
    options: context.fetchOptions,
    credentials: context.credentials,
    headers: context.headers,
  };
  const { query, variables } = selectHttpOptionsAndBody(
    operation,
    fallbackHttpConfig,
    contextConfig
  ).body;

  return from(window.openai.callTool("execute", { query, variables })).pipe(
    map((result) => ({ data: result.structuredContent.data }))
  );
});

// This allows us to extend the options with the "manifest" option AND make link/cache optional (they are normally required)
type ExtendedApolloClientOptions = Omit<
  ApolloClient.Options,
  "link" | "cache"
> & {
  link?: ApolloClient.Options["link"];
  cache?: ApolloClient.Options["cache"];
  manifest: ApplicationManifest;
};

export class ExtendedApolloClient extends ApolloClient {
  manifest: ApplicationManifest;

  constructor(options: ExtendedApolloClientOptions) {
    super({
      link: toolCallLink,
      cache: options.cache ?? new InMemoryCache(),
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
    // Write prefetched data to the cache
    this.manifest.operations.forEach((operation) => {
      if (
        operation.prefetch &&
        operation.prefetchID &&
        window.openai.toolOutput.prefetch?.[operation.prefetchID]
      ) {
        this.writeQuery({
          query: parse(operation.body),
          data: window.openai.toolOutput.prefetch[operation.prefetchID].data,
        });
      }

      // If this operation has the tool that matches up with the tool that was executed, write the tool result to the cache
      if (
        operation.tools?.find(
          (tool) =>
            `${this.manifest.name}--${tool.name}` ===
            window.openai.toolResponseMetadata.toolName
        )
      ) {
        // We need to include the variables that were used as part of the tool call so that we get a proper cache entry
        // However, we only want to include toolInput's that were graphql operation (ignore extraInputs)
        const variables = Object.keys(window.openai.toolInput).reduce(
          (obj, key) =>
            operation.variables[key] ?
              { ...obj, [key]: window.openai.toolInput[key] }
            : obj,
          {}
        );

        this.writeQuery({
          query: parse(operation.body),
          data: window.openai.toolOutput.result.data,
          variables,
        });
      }
    });
  }
}
