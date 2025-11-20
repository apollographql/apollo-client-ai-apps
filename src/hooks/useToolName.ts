import { useOpenAiGlobal } from "./useOpenAiGlobal";

export const useToolName = () => {
  const toolResponseMetadata = useOpenAiGlobal("toolResponseMetadata");

  return toolResponseMetadata?.toolName;
};
