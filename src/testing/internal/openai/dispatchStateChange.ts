import { SET_GLOBALS_EVENT_TYPE } from "../../../types/openai.js";

export function dispatchStateChange() {
  window.dispatchEvent(
    new CustomEvent(SET_GLOBALS_EVENT_TYPE, {
      detail: { globals: window.openai },
    })
  );
}
