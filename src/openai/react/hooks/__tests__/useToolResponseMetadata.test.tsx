import { afterEach, expect, test, vi } from "vitest";
import { stubOpenAiGlobals } from "../../../../testing/internal/index.js";
import { renderHookToSnapshotStream } from "@testing-library/react-render-stream";
import { useToolResponseMetadata } from "../useToolResponseMetadata.js";

afterEach(() => {
  vi.unstubAllGlobals();
});

test("returns the tool output set in window", async () => {
  stubOpenAiGlobals({ toolResponseMetadata: { toolName: "test" } });

  const { takeSnapshot } = await renderHookToSnapshotStream(() =>
    useToolResponseMetadata()
  );

  await expect(takeSnapshot()).resolves.toEqual({ toolName: "test" });
  await expect(takeSnapshot).not.toRerender();
});

test("returns null when not set", async () => {
  stubOpenAiGlobals();

  const { takeSnapshot } = await renderHookToSnapshotStream(() =>
    useToolResponseMetadata()
  );

  await expect(takeSnapshot()).resolves.toBeNull();
  await expect(takeSnapshot).not.toRerender();
});
