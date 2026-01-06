import { useCallback } from "react";
import { API } from "../../types/openai";

type OpenExternalFn = API<any>["openExternal"];

export function useOpenExternal() {
  return useCallback<OpenExternalFn>(
    (...args) => window.openai.openExternal(...args),
    []
  );
}
