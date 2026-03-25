import type { ToolInfo } from "../../core/typeRegistration.js";
import { useApolloClient } from "./internal/useApolloClient.js";

export function useToolInfo(): ToolInfo | undefined {
  return useApolloClient().toolInfo;
}
