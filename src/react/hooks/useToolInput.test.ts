import { expect, test, vi } from "vitest";
import { useToolInput } from "./useToolInput";
import { renderHook } from "@testing-library/react";

test("Should return tool input when called", async () => {
  vi.stubGlobal("openai", {
    toolInput: { name: "John" },
  });

  const { result } = renderHook(() => useToolInput());

  expect(result.current).toEqual({ name: "John" });
});
