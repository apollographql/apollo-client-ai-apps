import { SET_GLOBALS_EVENT_TYPE } from "../../../openai/types.js";
import "../../../openai/globals.js";

export function dispatchStateChange() {
  window.dispatchEvent(
    new CustomEvent(SET_GLOBALS_EVENT_TYPE, {
      detail: { globals: window.openai },
    })
  );
}
