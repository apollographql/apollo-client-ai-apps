import { expect, test, vi } from "vitest";
import { useOpenAiGlobal } from "./useOpenAiGlobal";
import { renderHook, act } from "@testing-library/react";
import { SET_GLOBALS_EVENT_TYPE } from "../types/openai";

test("Should update value when globals are updated and event it triggered", async () => {
  vi.stubGlobal("openai", {
    toolResponseMetadata: { toolName: "my-tool" },
  });

  const { result } = renderHook(() => useOpenAiGlobal("toolResponseMetadata"));
  const beforeValue = result.current.toolName;

  act(() => {
    vi.stubGlobal("openai", {
      toolResponseMetadata: { toolName: "my-other-tool" },
    });
    window.dispatchEvent(
      new CustomEvent(SET_GLOBALS_EVENT_TYPE, {
        detail: {
          globals: { toolResponseMetadata: { toolName: "my-other-tool" } },
        },
      })
    );
  });

  const afterValue = result.current.toolName;

  expect(beforeValue).toBe("my-tool");
  expect(afterValue).toBe("my-other-tool");
});

test("Should not update value when event key does not match the provided key", async () => {
  vi.stubGlobal("openai", {
    toolResponseMetadata: { toolName: "my-tool" },
  });

  const { result } = renderHook(() => useOpenAiGlobal("toolResponseMetadata"));
  const beforeValue = result.current.toolName;

  act(() => {
    vi.stubGlobal("openai", {
      toolResponseMetadata: { toolName: "my-other-tool" },
    });
    window.dispatchEvent(
      new CustomEvent(SET_GLOBALS_EVENT_TYPE, {
        detail: { globals: { toolInput: { id: 1 } } },
      })
    );
  });

  const afterValue = result.current.toolName;

  expect(beforeValue).toBe("my-tool");
  expect(afterValue).toBe("my-tool");
});
