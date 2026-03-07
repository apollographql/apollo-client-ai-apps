import type { ToolName } from "../../../core/typeRegistration.js";
import { useApolloClient } from "./useApolloClient.js";

export const useToolName = (): ToolName | undefined => {
  return useApolloClient()["appManager"].toolName;
};
