import { useOpenAiGlobal } from "./useOpenAiGlobal.js";

export function useToolOutput() {
  return useOpenAiGlobal("toolOutput") ?? null;
}
