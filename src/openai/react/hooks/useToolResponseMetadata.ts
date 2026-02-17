import { useApolloClient } from "./useApolloClient.js";

export function useToolResponseMetadata() {
  return useApolloClient()["appManager"].toolMetadata;
}
