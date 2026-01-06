import { afterEach, expect, test, vi } from "vitest";
import {
  dispatchStateChange,
  stubOpenAiGlobals,
} from "../../../testing/internal";
import { renderHookToSnapshotStream } from "@testing-library/react-render-stream";
import { useToolOutput } from "../useToolOutput";

afterEach(() => {
  vi.unstubAllGlobals();
});

test("returns the tool output set in window", async () => {
  stubOpenAiGlobals({ toolOutput: { test: true } });

  const { takeSnapshot } = await renderHookToSnapshotStream(() =>
    useToolOutput()
  );

  await expect(takeSnapshot()).resolves.toEqual({ test: true });
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

test("reacts to changes in globals", async () => {
  stubOpenAiGlobals({ toolOutput: { initial: true } });

  const { takeSnapshot } = await renderHookToSnapshotStream(() =>
    useToolOutput()
  );

  await expect(takeSnapshot()).resolves.toEqual({ initial: true });

  window.openai.toolOutput = { updated: true };
  dispatchStateChange();

  await expect(takeSnapshot()).resolves.toEqual({ updated: true });
  await expect(takeSnapshot).not.toRerender();
});
