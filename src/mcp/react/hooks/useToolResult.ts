import { useCallback, useSyncExternalStore } from "react";
import { useApolloClient } from "./useApolloClient";

export function useToolResult() {
  const client = useApolloClient();

  return useSyncExternalStore(
    useCallback(
      (update) => client.appManager.onChange("toolResult", update),
      [client]
    ),
    () => client.appManager.toolResult
  );
}
