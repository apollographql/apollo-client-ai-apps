import { useOpenAiGlobal } from "./useOpenAiGlobal";

export const useToolInput = () => {
  const toolInput = useOpenAiGlobal("toolInput");

  return toolInput;
};
