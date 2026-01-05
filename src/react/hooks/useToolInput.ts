import { useOpenAiGlobal } from "./useOpenAiGlobal";

export const useToolInput = (): any => {
  const toolInput = useOpenAiGlobal("toolInput");

  return toolInput;
};
