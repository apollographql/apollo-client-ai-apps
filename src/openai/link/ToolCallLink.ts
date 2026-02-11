import { ApolloLink, Observable } from "@apollo/client";
import { print } from "@apollo/client/utilities";
import { from, map } from "rxjs";

/**
 * A terminating link that sends a GraphQL request through an agent tool call.
 * When providing a custom link chain to `ApolloClient`, `ApolloClient` will
 * validate that the terminating link is an instance of this link.
 *
 * @example Providing a custom link chain
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
    const { query, variables } = operation;

    return from(
      window.openai.callTool("execute", { query: print(query), variables })
    ).pipe(map((result) => ({ data: result.structuredContent.data })));
  }
}
