import type { DisplayMode } from "../../types/openai.js";

export const useRequestDisplayMode = () => {
  return async (args: { mode: DisplayMode }) => {
    return await window.openai?.requestDisplayMode(args);
  };
};
