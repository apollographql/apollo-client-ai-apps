import { SET_GLOBALS_EVENT_TYPE } from "../../../types/openai";

export function dispatchStateChange() {
  window.dispatchEvent(
    new CustomEvent(SET_GLOBALS_EVENT_TYPE, {
      detail: { globals: window.openai },
    })
  );
}
