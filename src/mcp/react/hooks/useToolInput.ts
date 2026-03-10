import type { ToolInput } from "../../../core/typeRegistration.js";
import { useApolloClient } from "./useApolloClient.js";

/**
 * @deprecated Please use the `useToolInfo` hook. `useToolInput` will be removed
 * in the next major version.
 */
export function useToolInput(): ToolInput | undefined {
  return useApolloClient()["appManager"].toolInput as ToolInput | undefined;
}
