import { useCallback, useSyncExternalStore } from "react";
import { useApolloClient } from "./useApolloClient";

export function useHostContext() {
  const appManager = useApolloClient()["appManager"];

  return useSyncExternalStore(
    useCallback(
      (update) => appManager.onHostContextChanged(update),
      [appManager]
    ),
    () => appManager.app.getHostContext()
  );
}
