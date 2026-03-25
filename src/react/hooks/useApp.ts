import { useApolloClient } from "./internal/useApolloClient.js";

export function useApp() {
  return useApolloClient()["appManager"].app;
}
