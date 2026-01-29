import { useApolloClient } from "./useApolloClient.js";

export function useApp() {
  const client = useApolloClient();

  return client.app.app;
}
