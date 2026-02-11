import { useOpenAiGlobal } from "./useOpenAiGlobal.js";

export function useToolResponseMetadata() {
  return useOpenAiGlobal("toolResponseMetadata") ?? null;
}
