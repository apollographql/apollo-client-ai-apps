import { useApolloClient } from "./useApolloClient";

export function useToolName() {
  return useApolloClient()["appManager"].toolName;
}
