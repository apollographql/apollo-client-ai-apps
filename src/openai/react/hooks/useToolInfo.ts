import type { ToolInfo } from "../../../core/typeRegistration.js";
import { useApolloClient } from "./useApolloClient.js";

export function useToolInfo(): ToolInfo | undefined {
  const appManager = useApolloClient()["appManager"];
  const toolName = appManager.toolName;

  if (!toolName) {
    return;
  }

  return { toolName, toolInput: appManager.toolInput };
}
