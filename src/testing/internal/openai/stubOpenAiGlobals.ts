import { vi } from "vitest";
import type {
  API,
  OpenAiGlobals,
  UnknownObject,
} from "../../../openai/types.js";
import { dispatchStateChange } from "./dispatchStateChange.js";

export function stubOpenAiGlobals(globals?: Partial<API<any> & OpenAiGlobals>) {
  vi.stubGlobal("openai", {
    setWidgetState: (state: UnknownObject) => {
      window.openai.widgetState = state;
      dispatchStateChange();
    },
    ...globals,
  });
}
