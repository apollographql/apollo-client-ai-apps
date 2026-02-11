import { expect, test, vi } from "vitest";
import { useRequestDisplayMode } from "../useRequestDisplayMode.js";
import type { DisplayMode } from "../../../types.js";

test("Should set display mode when returned function is called", async () => {
  vi.stubGlobal("openai", {
    requestDisplayMode: vi.fn(async (args: { mode: DisplayMode }) => {
      return args;
    }),
  });

  const requestDisplayMode = useRequestDisplayMode();
  const result = await requestDisplayMode({ mode: "inline" });

  expect(window.openai.requestDisplayMode).toBeCalledWith({ mode: "inline" });
  expect(result).toEqual({ mode: "inline" });
});
