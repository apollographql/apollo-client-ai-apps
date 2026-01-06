import { vi } from "vitest";
import { API, OpenAiGlobals, UnknownObject } from "../../../types/openai";
import { dispatchStateChange } from "./dispatchStateChange";

export function stubOpenAiGlobals(globals?: Partial<API<any> & OpenAiGlobals>) {
  vi.stubGlobal("openai", {
    setWidgetState: (state: UnknownObject) => {
      window.openai.widgetState = state;
      dispatchStateChange();
    },
    ...globals,
  });
}
