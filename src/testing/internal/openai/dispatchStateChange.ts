import { SET_GLOBALS_EVENT_TYPE } from "../../../openai/types.js";

export function dispatchStateChange() {
  window.dispatchEvent(
    new CustomEvent(SET_GLOBALS_EVENT_TYPE, {
      detail: { globals: window.openai },
    })
  );
}
