import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { ApolloProvider as BaseApolloProvider } from "@apollo/client/react";
import type { ApolloClient } from "../core/ApolloClient.js";
import { SET_GLOBALS_EVENT_TYPE } from "../types/openai.js";

export declare namespace ApolloProvider {
  export interface Props {
    children?: ReactNode;
    client: ApolloClient;
  }
}

export const ApolloProvider = ({ children, client }: ApolloProvider.Props) => {
  const [hasPreloaded, setHasPreloaded] = useState(false);

  // This is to prevent against a race condition. We don't know if window.openai will be available when this loads or if it will become available shortly after.
  // So... we create the event listener and whenever it is available, then we can process the prefetch/tool data.
  // In practice, this should be pretty much instant
  useEffect(() => {
    const prefetchData = async () => {
      await client.prefetchData();
      setHasPreloaded(true);
      window.removeEventListener(SET_GLOBALS_EVENT_TYPE, prefetchData);
    };

    window.addEventListener(SET_GLOBALS_EVENT_TYPE, prefetchData, {
      passive: true,
    });

    if (window.openai?.toolOutput) {
      window.dispatchEvent(new CustomEvent(SET_GLOBALS_EVENT_TYPE));
    }

    return () => {
      window.removeEventListener(SET_GLOBALS_EVENT_TYPE, prefetchData);
    };
  }, []);

  return hasPreloaded ?
      <BaseApolloProvider client={client}>{children}</BaseApolloProvider>
    : null;
};
