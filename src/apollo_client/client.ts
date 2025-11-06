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

export class ExtendedApolloClient extends ApolloClient {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  constructor(options: { manifest: any }) {
    super({
      link: new PersistedQueryLink({
        sha256: (queryString) => sha256(queryString),
      }).concat(
        new ApolloLink((operation) => {
          const context = operation.getContext();
          const contextConfig = {
            http: context.http,
            options: context.fetchOptions,
            credentials: context.credentials,
            headers: context.headers,
          };
          const { extensions, variables } = selectHttpOptionsAndBody(operation, fallbackHttpConfig, contextConfig).body;

          return Observable.from(
            window.openai.callTool("execute_persisted_query", { id: extensions?.persistedQuery.sha256Hash, variables })
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ).pipe(Observable.map((result) => ({ data: (result as any).data as any })));
        })
      ),
      cache: new InMemoryCache(),
      documentTransform: new DocumentTransform((document) => {
        return removeDirectivesFromDocument([{ name: "prefetch" }], document)!;
      }),
    });

    this.prefetchData(options.manifest);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async prefetchData(manifest: any) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    manifest.operations.forEach((operation: any) => {
      if (operation.prefetch && window.openai.toolOutput.structuredContent[operation.id]) {
        this.writeQuery({
          query: parse(operation.body),
          data: window.openai.toolOutput.structuredContent[operation.id].data,
        });
      }
    });
  }
}
