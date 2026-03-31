import { useApolloClient as useBaseApolloClient } from "@apollo/client/react";
import { AbstractApolloClient } from "../../../core/AbstractApolloClient.js";
import { aiClientSymbol, invariant } from "../../../utilities/index.js";

export function useApolloClient() {
  const client = useBaseApolloClient() as AbstractApolloClient;

  invariant(
    client[aiClientSymbol],
    'The "client" instance provided to <ApolloProvider /> is the wrong instance. You might have imported `ApolloClient` from `@apollo/client`. Please import `ApolloClient` from `@apollo/client-ai-apps` instead.'
  );

  return client;
}
