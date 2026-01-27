import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { ApolloProvider as BaseApolloProvider } from "@apollo/client/react";
import type { ApolloClient } from "../openai/core/ApolloClient.js";
import { __DEV__ } from "@apollo/client/utilities/environment";
import { aiClientSymbol, invariant } from "../utilities/index.js";

export declare namespace ApolloProvider {
  export interface Props {
    children?: ReactNode;
    client: ApolloClient;
  }
}

export const ApolloProvider = ({ children, client }: ApolloProvider.Props) => {
  const [hasPreloaded, setHasPreloaded] = useState(false);

  if (__DEV__) {
    invariant(
      client["info"] === aiClientSymbol,
      'The "client" instance provided to <ApolloProvider /> is the wrong instance. You might have imported `ApolloClient` from `@apollo/client`. Please import `ApolloClient` from `@apollo/client-ai-apps` instead.'
    );
  }

  useEffect(() => {
    let ignored = false;

    (async function prefetchData() {
      await client.prefetchData();

      if (!ignored) {
        setHasPreloaded(true);
      }
    })();

    return () => {
      ignored = true;
    };
  }, []);

  return hasPreloaded ?
      <BaseApolloProvider client={client}>{children}</BaseApolloProvider>
    : null;
};
