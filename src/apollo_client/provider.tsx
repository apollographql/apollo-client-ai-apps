import React from "react";
import { ApolloProvider } from "@apollo/client/react";
import { ExtendedApolloClient } from "./client";

export const ExtendedApolloProvider = ({
  children,
  client,
}: React.PropsWithChildren<{ client: ExtendedApolloClient }>) => {
  return <ApolloProvider client={client}>{children}</ApolloProvider>;
};
