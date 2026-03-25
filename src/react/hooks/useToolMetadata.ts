import { useApolloClient } from "./internal/useApolloClient.js";

export function useToolMetadata() {
  return useApolloClient().toolMetadata;
}
