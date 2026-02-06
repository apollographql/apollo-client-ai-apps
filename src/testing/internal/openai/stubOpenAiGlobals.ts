import { vi } from "vitest";
import type {
  API,
  OpenAiGlobals,
  UnknownObject,
} from "../../../openai/types.js";
import "../../../openai/globals.js";
import { dispatchStateChange } from "./dispatchStateChange.js";

type Globals = Partial<API<any> & OpenAiGlobals>;

export function stubOpenAiGlobals(
  globals?: Globals | ((defaults: Partial<Globals>) => Partial<Globals>)
) {
  const defaults = {
    setWidgetState: async (state: UnknownObject) => {
      window.openai.widgetState = state;
      dispatchStateChange();
    },
    // Using a `null` here instead of `undefined` allows for the client to fully
    // initialize without having to wait for the global openAI event.
    toolOutput: null,
  } satisfies Partial<Globals>;

  vi.stubGlobal(
    "openai",
    typeof globals === "function" ?
      globals(defaults)
    : { ...defaults, ...globals }
  );
}
