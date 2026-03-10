import type { ToolInput } from "../../../core/typeRegistration.js";
import { useApolloClient } from "./useApolloClient.js";

export function useToolInput(): ToolInput | undefined {
  return useApolloClient()["appManager"].toolInput as ToolInput | undefined;
}
