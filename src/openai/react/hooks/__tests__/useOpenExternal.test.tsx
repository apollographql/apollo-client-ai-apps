import { expect, test, vi } from "vitest";
import { renderHookToSnapshotStream } from "@testing-library/react-render-stream";
import { useOpenExternal } from "../useOpenExternal.js";
import { stubOpenAiGlobals } from "../../../../testing/internal/index.js";

test("calls the global openExternal function", async () => {
  const openExternalMock = vi.fn();

  stubOpenAiGlobals({ openExternal: openExternalMock });

  const { takeSnapshot } = await renderHookToSnapshotStream(() =>
    useOpenExternal()
  );

  const openExternal = await takeSnapshot();
  openExternal({ href: "https://example.com" });

  expect(openExternalMock).toHaveBeenCalledTimes(1);
  expect(openExternalMock).toHaveBeenCalledWith({
    href: "https://example.com",
  });

  await expect(takeSnapshot).not.toRerender();
});
