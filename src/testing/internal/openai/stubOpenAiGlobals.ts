import { vi } from "vitest";
import type {
  API,
  OpenAiGlobals,
  UnknownObject,
} from "../../../openai/types.js";
import "../../../openai/globals.js";
import { dispatchStateChange } from "./dispatchStateChange.js";

type Globals = API<any> & OpenAiGlobals;

const DEFAULTS = Object.freeze({
  setWidgetState: async (state: UnknownObject) => {
    window.openai.widgetState = state;
    dispatchStateChange();
  },
  // Using a `null` here instead of `undefined` allows for the client to fully
  // initialize without having to wait for the global openAI event.
  toolOutput: null,
}) satisfies Partial<Globals>;

export function stubOpenAiGlobals(
  globals?: Partial<Globals> | ((defaults: typeof DEFAULTS) => Partial<Globals>)
) {
  vi.stubGlobal(
    "openai",
    typeof globals === "function" ?
      globals(DEFAULTS)
    : { ...DEFAULTS, ...globals }
  );
}
