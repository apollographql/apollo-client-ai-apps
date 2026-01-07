import { useCallback } from "react";
import type { API } from "../../types/openai.js";

type OpenExternalFn = API<any>["openExternal"];

export function useOpenExternal() {
  return useCallback<OpenExternalFn>(
    (...args) => window.openai.openExternal(...args),
    []
  );
}
