import { ApolloClient, ApolloLink } from "@apollo/client";
import { __DEV__ } from "@apollo/client/utilities/environment";
import { from } from "rxjs";

import type { McpAppManager } from "../core/McpAppManager";
import { aiClientSymbol, invariant } from "../utilities/index.js";

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
  readonly name = "ToolCallLink";
  request(operation: ApolloLink.Operation) {
    const client = getPrivateAccess(operation.client);

    return from(
      client.appManager.executeQuery({
        query: operation.query,
        variables: operation.variables,
      })
    );
  }
}

function getPrivateAccess(
  client: ApolloClient
): ApolloClient & { appManager: McpAppManager } {
  if (__DEV__) {
    invariant(
      (client as any)[aiClientSymbol],
      'The "client" instance used with `ToolCallLink` is the wrong instance. You might have imported `ApolloClient` from `@apollo/client`. Please import `ApolloClient` from `@apollo/client-ai-apps` instead.'
    );
  }

  return client as any;
}
