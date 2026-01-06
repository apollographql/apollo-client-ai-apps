import { useOpenAiGlobal } from "./useOpenAiGlobal";

export function useToolOutput() {
  return useOpenAiGlobal("toolOutput") ?? null;
}
