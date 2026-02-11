import { ApolloLink } from "@apollo/client";

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
  constructor() {
    super();

    throw new Error(
      "Cannot construct a `ToolCallLink` from `@apollo/client-ai-apps` without export conditions. Please set export conditions or import from  the `/openai` or `/mcp` subpath directly."
    );
  }
}
