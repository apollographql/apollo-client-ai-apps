import type { ReactNode } from "react";
import { use } from "react";
import { ApolloProvider as BaseApolloProvider } from "@apollo/client/react";
import type { ApolloClient as BaseApolloClient } from "@apollo/client";
import { ApolloClient as OpenAiApolloClient } from "../openai/core/ApolloClient.js";
import { ApolloClient as McpApolloClient } from "../mcp/core/ApolloClient.js";
import type { ApolloClient as FallbackApolloClient } from "../core/ApolloClient.js";
import { __DEV__ } from "@apollo/client/utilities/environment";
import { aiClientSymbol, invariant } from "../utilities/index.js";

type ApolloClient = OpenAiApolloClient | McpApolloClient | FallbackApolloClient;

export declare namespace ApolloProvider {
  export interface Props {
    children?: ReactNode;
    client: ApolloClient;
  }
}

export function ApolloProvider({ children, client }: ApolloProvider.Props) {
  if (__DEV__) {
    invariant(
      client.info === aiClientSymbol,
      'The "client" instance provided to <ApolloProvider /> is the wrong instance. You might have imported `ApolloClient` from `@apollo/client`. Please import `ApolloClient` from `@apollo/client-ai-apps` instead.'
    );
  }

  use(client.waitForInitialization());

  return (
    <BaseApolloProvider client={client as BaseApolloClient}>
      {children}
    </BaseApolloProvider>
  );
}
