import { DisplayMode } from "../types/openai";

export const useRequestDisplayMode = () => {
  return async (args: { mode: DisplayMode }) => {
    await window.openai?.requestDisplayMode(args);
  };
};
