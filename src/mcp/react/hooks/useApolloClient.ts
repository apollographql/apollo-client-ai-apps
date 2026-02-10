import { useApolloClient as useBaseApolloClient } from "@apollo/client/react";
import { ApolloClient } from "../../core/ApolloClient";
import { invariant } from "@apollo/client/utilities/invariant";
import { aiClientSymbol } from "../../../utilities";

export function useApolloClient(override?: ApolloClient) {
  const client = useBaseApolloClient(override) as ApolloClient;

  invariant(
    client[aiClientSymbol],
    'The "client" instance provided to <ApolloProvider /> is the wrong instance. You might have imported `ApolloClient` from `@apollo/client`. Please import `ApolloClient` from `@apollo/client-ai-apps` instead.'
  );

  return client;
}
