import { useSyncExternalStore, useCallback } from "react";
import type { SetGlobalsEvent, OpenAiGlobals } from "../../types.js";
import { SET_GLOBALS_EVENT_TYPE } from "../../types.js";

export function useOpenAiGlobal<K extends keyof OpenAiGlobals>(
  key: K
): OpenAiGlobals[K] {
  return useSyncExternalStore(
    useCallback((onChange) => {
      const handleSetGlobal = (event: SetGlobalsEvent) => {
        const value = event.detail.globals[key];
        if (value === undefined) {
          return;
        }

        onChange();
      };

      window.addEventListener(SET_GLOBALS_EVENT_TYPE, handleSetGlobal, {
        passive: true,
      });

      return () => {
        window.removeEventListener(SET_GLOBALS_EVENT_TYPE, handleSetGlobal);
      };
    }, []),
    () => window.openai[key]
  );
}
