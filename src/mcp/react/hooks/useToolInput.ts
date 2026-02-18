import { useApolloClient } from "./useApolloClient.js";

export function useToolInput() {
  return useApolloClient()["appManager"].toolInput;
}
