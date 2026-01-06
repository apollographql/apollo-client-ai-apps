import { useOpenAiGlobal } from "./useOpenAiGlobal";

export function useToolResponseMetadata() {
  return useOpenAiGlobal("toolResponseMetadata") ?? null;
}
