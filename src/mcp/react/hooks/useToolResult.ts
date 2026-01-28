import { useCallback, useSyncExternalStore } from "react";
import { useApolloClient } from "./useApolloClient";

export function useToolResult() {
  const client = useApolloClient();

  return useSyncExternalStore(
    useCallback(
      (update) => client.app.onChange("toolResult", update),
      [client]
    ),
    () => client.app.toolResult
  );
}
