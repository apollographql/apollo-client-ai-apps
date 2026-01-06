import { vi } from "vitest";
import {
  OpenAiGlobals,
  SET_GLOBALS_EVENT_TYPE,
  UnknownObject,
} from "../../../types/openai";

export function stubOpenAiGlobals(globals?: Partial<OpenAiGlobals>) {
  vi.stubGlobal("openai", {
    setWidgetState: (state: UnknownObject) => {
      window.openai.widgetState = state;
      window.dispatchEvent(
        new CustomEvent(SET_GLOBALS_EVENT_TYPE, {
          detail: { globals: window.openai },
        })
      );
    },
    ...globals,
  });
}
