import { useApolloClient } from "./useApolloClient";

export function useToolMetadata() {
  return useApolloClient()["appManager"].toolMetadata;
}
