import { useOpenAiGlobal } from "./useOpenAiGlobal";

export const useToolName = (): string | undefined => {
  const toolResponseMetadata = useOpenAiGlobal("toolResponseMetadata");

  return toolResponseMetadata?.toolName as string;
};
