import { useApolloClient } from "./useApolloClient.js";

export function useToolName() {
  return useApolloClient()["appManager"].toolName;
}
