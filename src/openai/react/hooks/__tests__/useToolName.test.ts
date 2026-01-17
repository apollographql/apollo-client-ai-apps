import { expect, test, vi } from "vitest";
import { useToolName } from "../useToolName.js";
import { renderHook } from "@testing-library/react";

test("Should return tool input when called", async () => {
  vi.stubGlobal("openai", {
    toolResponseMetadata: { toolName: "get-products" },
  });

  const { result } = renderHook(() => useToolName());

  expect(result.current).toBe("get-products");
});
