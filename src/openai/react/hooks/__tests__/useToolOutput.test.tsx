import { afterEach, expect, test, vi } from "vitest";
import { stubOpenAiGlobals } from "../../../../testing/internal/index.js";
import { renderHookToSnapshotStream } from "@testing-library/react-render-stream";
import { useToolOutput } from "../useToolOutput.js";

afterEach(() => {
  vi.unstubAllGlobals();
});

test("returns the tool output set in window", async () => {
  stubOpenAiGlobals({ toolOutput: { result: { data: { foo: true } } } });

  const { takeSnapshot } = await renderHookToSnapshotStream(() =>
    useToolOutput()
  );

  await expect(takeSnapshot()).resolves.toEqual({
    result: { data: { foo: true } },
  });
  await expect(takeSnapshot).not.toRerender();
});

test("returns null when not set", async () => {
  stubOpenAiGlobals();

  const { takeSnapshot } = await renderHookToSnapshotStream(() =>
    useToolOutput()
  );

  await expect(takeSnapshot()).resolves.toBeNull();
  await expect(takeSnapshot).not.toRerender();
});
