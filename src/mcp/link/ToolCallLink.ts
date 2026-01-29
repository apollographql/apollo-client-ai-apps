import { ApolloLink, Observable } from "@apollo/client";
import { from } from "rxjs";
import type { ApolloClient as McpApolloClient } from "../core/ApolloClient";

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
    const client = operation.client as McpApolloClient;

    return from(
      client.app.executeQuery({
        query: operation.query,
        variables: operation.variables,
      })
    );
  }
}
