import React, { useEffect, useState } from "react";
import { ApolloProvider } from "@apollo/client/react";
import { ExtendedApolloClient } from "./client";
import { SET_GLOBALS_EVENT_TYPE } from "../types/openai";

export const ExtendedApolloProvider = ({
  children,
  client,
}: React.PropsWithChildren<{ client: ExtendedApolloClient }>) => {
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
  }, []);

  return hasPreloaded ?
      <ApolloProvider client={client}>{children}</ApolloProvider>
    : null;
};
