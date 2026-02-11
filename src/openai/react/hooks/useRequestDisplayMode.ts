import type { DisplayMode } from "../../types.js";

export const useRequestDisplayMode = () => {
  return async (args: { mode: DisplayMode }) => {
    return await window.openai?.requestDisplayMode(args);
  };
};
