import { DisplayMode } from "../../types/openai";

export const useRequestDisplayMode = () => {
  return async (args: { mode: DisplayMode }) => {
    return await window.openai?.requestDisplayMode(args);
  };
};
