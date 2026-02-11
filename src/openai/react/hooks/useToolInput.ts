import { useOpenAiGlobal } from "./useOpenAiGlobal.js";

export const useToolInput = (): any => {
  const toolInput = useOpenAiGlobal("toolInput");

  return toolInput;
};
