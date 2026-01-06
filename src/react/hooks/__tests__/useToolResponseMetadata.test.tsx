import { afterEach, expect, test, vi } from "vitest";
import {
  dispatchStateChange,
  stubOpenAiGlobals,
} from "../../../testing/internal";
import { renderHookToSnapshotStream } from "@testing-library/react-render-stream";
import { useToolResponseMetadata } from "../useToolResponseMetadata";

afterEach(() => {
  vi.unstubAllGlobals();
});

test("returns the tool output set in window", async () => {
  stubOpenAiGlobals({ toolResponseMetadata: { test: true } });

  const { takeSnapshot } = await renderHookToSnapshotStream(() =>
    useToolResponseMetadata()
  );

  await expect(takeSnapshot()).resolves.toEqual({ test: true });
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

test("reacts to changes in globals", async () => {
  stubOpenAiGlobals({ toolResponseMetadata: { initial: true } });

  const { takeSnapshot } = await renderHookToSnapshotStream(() =>
    useToolResponseMetadata()
  );

  await expect(takeSnapshot()).resolves.toEqual({ initial: true });

  window.openai.toolResponseMetadata = { updated: true };
  dispatchStateChange();

  await expect(takeSnapshot()).resolves.toEqual({ updated: true });
  await expect(takeSnapshot).not.toRerender();
});
