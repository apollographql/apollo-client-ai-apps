import { ApolloClient, ApolloLink, InMemoryCache } from "@apollo/client";
import { PersistedQueryLink } from "@apollo/client/link/persisted-queries";
import * as Observable from "rxjs";
import { sha256 } from "crypto-hash";
import { selectHttpOptionsAndBody } from "@apollo/client/link/http";
import { fallbackHttpConfig } from "@apollo/client/link/http";
import { DocumentTransform } from "@apollo/client";
import { removeDirectivesFromDocument } from "@apollo/client/utilities/internal";
import { parse } from "graphql";
import "../types/openai";

const toolCallLink = new ApolloLink((operation) => {
  const context = operation.getContext();
  const contextConfig = {
    http: context.http,
    options: context.fetchOptions,
    credentials: context.credentials,
    headers: context.headers,
  };
  const { query, variables } = selectHttpOptionsAndBody(operation, fallbackHttpConfig, contextConfig).body;

  return Observable.from(
    window.openai.callTool("execute", { query, variables })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ).pipe(Observable.map((result) => ({ data: result.structuredContent.data })));
});

// TODO: In the future if/when we support PQs again, do pqLink.concat(toolCallLink)
// Commenting this out for now.
// const pqLink = new PersistedQueryLink({
//   sha256: (queryString) => sha256(queryString),
// });

type ExtendedApolloClientOptions = Omit<ApolloClient.Options, "link" | "cache"> & {
  link?: ApolloClient.Options["link"];
  cache?: ApolloClient.Options["cache"];
  manifest: any;
};

export class ExtendedApolloClient extends ApolloClient {
  manifest: any;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  constructor(options: ExtendedApolloClientOptions) {
    super({
      link: toolCallLink,
      cache: options.cache ?? new InMemoryCache(),
      documentTransform: new DocumentTransform((document) => {
        return removeDirectivesFromDocument([{ name: "prefetch" }, { name: "tool" }], document)!;
      }),
    });

    this.manifest = options.manifest;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async prefetchData() {
    // Write prefetched data to the cache
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this.manifest.operations.forEach((operation: any) => {
      if (operation.prefetch && window.openai.toolOutput.prefetch[operation.prefetchID]) {
        this.writeQuery({
          query: parse(operation.body),
          data: window.openai.toolOutput.prefetch[operation.prefetchID].data,
        });
      }

      // If this operation has the tool that matches up with the tool that was executed, write the tool result to the cache
      if (
        operation.tools?.find(
          (tool: any) => `${this.manifest.name}--${tool.name}` === window.openai.toolResponseMetadata.toolName
        )
      ) {
        // We need to include the variables that were used as part of the tool call so that we get a proper cache entry
        // However, we only want to include toolInput's that were graphql operation (ignore extraInputs)
        const variables = Object.keys(window.openai.toolInput).reduce(
          (obj, key) => (operation.variables[key] ? { ...obj, [key]: window.openai.toolInput[key] } : obj),
          {}
        );

        this.writeQuery({
          query: parse(operation.body),
          data: window.openai.toolOutput.result.data,
          variables,
        });
      }
    });

    console.log("Loaded into cache:", this.extract());
  }
}
