import { ApolloLink, Observable } from "@apollo/client";
import { from, map } from "rxjs";
import {
  fallbackHttpConfig,
  selectHttpOptionsAndBody,
} from "@apollo/client/link/http";

/**
 * A terminating link that sends a GraphQL request through an agent tool call.
 * When providing a custom link chain to `ApolloClient`, `ApolloClient` will
 * validate that the terminating link is an instance of this link.
 *
 * @example Provding a custom link chain
 *
 * ```ts
 * import { ApolloLink } from "@apollo/client";
 * import { ApolloClient, ToolCallLink } from "@apollo/client-ai-apps";
 *
 * const link = ApolloLink.from([
 *   ...otherLinks,
 *   new ToolCallLink()
 * ]);
 *
 * const client = new ApolloClient({
 *   link,
 *   // ...
 * });
 * ```
 */
export class ToolCallLink extends ApolloLink {
  request(operation: ApolloLink.Operation): Observable<ApolloLink.Result> {
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
  }
}
