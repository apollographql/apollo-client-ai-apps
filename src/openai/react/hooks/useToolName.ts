import type { ToolName } from "../../../core/typeRegistration.js";
import { useApolloClient } from "./useApolloClient.js";

/**
 * @deprecated Please use the `useToolInfo` hook. `useToolName` will be removed
 * in the next major version.
 */
export const useToolName = (): ToolName | undefined => {
  return useApolloClient()["appManager"].toolName;
};
