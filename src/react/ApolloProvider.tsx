import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { ApolloProvider as BaseApolloProvider } from "@apollo/client/react";
import type { ApolloClient } from "../openai/core/ApolloClient.js";

export declare namespace ApolloProvider {
  export interface Props {
    children?: ReactNode;
    client: ApolloClient;
  }
}

export const ApolloProvider = ({ children, client }: ApolloProvider.Props) => {
  const [hasPreloaded, setHasPreloaded] = useState(false);

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
