import type { API, OpenAiGlobals } from "./types.js";
import type { SET_GLOBALS_EVENT_TYPE, SetGlobalsEvent } from "./types.js";

declare global {
  interface Window {
    openai: API<any> & OpenAiGlobals;
  }

  interface WindowEventMap {
    [SET_GLOBALS_EVENT_TYPE]: SetGlobalsEvent;
  }
}

export {};
