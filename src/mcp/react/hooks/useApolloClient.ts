import { useApolloClient as useBaseApolloClient } from "@apollo/client/react";
import { ApolloClient } from "../../core/ApolloClient";

export const useApolloClient = useBaseApolloClient as (
  override?: ApolloClient
) => ApolloClient;
