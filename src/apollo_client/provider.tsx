import React, { useEffect, useState } from "react";
import { ApolloProvider } from "@apollo/client/react";
import { ExtendedApolloClient } from "./client";
import { SET_GLOBALS_EVENT_TYPE } from "../types/openai";

export const ExtendedApolloProvider = ({
  children,
  client,
}: React.PropsWithChildren<{ client: ExtendedApolloClient }>) => {
  const [hasPreloaded, setHasPreloaded] = useState(false);

  useEffect(() => {
    const prefetchData = async () => {
      await client.prefetchData();
      setHasPreloaded(true);
      window.removeEventListener(SET_GLOBALS_EVENT_TYPE, prefetchData);
    };

    window.addEventListener(SET_GLOBALS_EVENT_TYPE, prefetchData, {
      passive: true,
    });

    if (window.openai.toolOutput) {
      window.dispatchEvent(new CustomEvent(SET_GLOBALS_EVENT_TYPE));
    }
  }, [setHasPreloaded]);

  return hasPreloaded ? <ApolloProvider client={client}>{children}</ApolloProvider> : null;
};
