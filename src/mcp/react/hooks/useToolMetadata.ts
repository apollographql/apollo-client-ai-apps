import { useApolloClient } from "./useApolloClient.js";

export function useToolMetadata() {
  return useApolloClient()["appManager"].toolMetadata;
}
