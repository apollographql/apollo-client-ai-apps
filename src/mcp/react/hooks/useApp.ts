import { useApolloClient } from "./useApolloClient.js";

export function useApp() {
  return useApolloClient()["appManager"].app;
}
