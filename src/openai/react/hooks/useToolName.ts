import { useApolloClient } from "./useApolloClient.js";

export const useToolName = () => {
  return useApolloClient()["appManager"].toolName;
};
