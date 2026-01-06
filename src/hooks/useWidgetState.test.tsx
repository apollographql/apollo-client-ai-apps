import { afterEach, expect, test, vi } from "vitest";
import {
  disableActEnvironment,
  renderHookToSnapshotStream,
} from "@testing-library/react-render-stream";
import { useWidgetState } from "./useWidgetState";
import { stubOpenAiGlobals } from "../testing/internal";

afterEach(() => {
  vi.unstubAllGlobals();
});

test("returns state from global", async () => {
  stubOpenAiGlobals({ widgetState: { test: true } });

  using _disabledAct = disableActEnvironment();
  const { takeSnapshot } = await renderHookToSnapshotStream(() =>
    useWidgetState()
  );

  const [widgetState] = await takeSnapshot();

  expect(widgetState).toEqual({ test: true });
});

test("returns null when global does not exist", async () => {
  stubOpenAiGlobals();

  using _disabledAct = disableActEnvironment();
  const { takeSnapshot } = await renderHookToSnapshotStream(() =>
    useWidgetState()
  );

  const [widgetState] = await takeSnapshot();

  expect(widgetState).toBeNull();
});

test("returns provided default state when global does not exist", async () => {
  stubOpenAiGlobals();

  using _disabledAct = disableActEnvironment();
  const { takeSnapshot } = await renderHookToSnapshotStream(() =>
    useWidgetState({ defaultValue: true })
  );

  const [widgetState] = await takeSnapshot();

  expect(widgetState).toEqual({ defaultValue: true });
});

test("returns provided default state returned from init function when global does not exist", async () => {
  stubOpenAiGlobals();

  using _disabledAct = disableActEnvironment();
  const { takeSnapshot } = await renderHookToSnapshotStream(() =>
    useWidgetState(() => ({ defaultValueFromFunction: true }))
  );

  const [widgetState] = await takeSnapshot();

  expect(widgetState).toEqual({ defaultValueFromFunction: true });
});

test("prefers global value over default value", async () => {
  stubOpenAiGlobals({ widgetState: { globalWidgetState: true } });

  using _disabledAct = disableActEnvironment();
  const { takeSnapshot } = await renderHookToSnapshotStream(() =>
    useWidgetState({ defaultValue: true })
  );

  const [widgetState] = await takeSnapshot();

  expect(widgetState).toEqual({ globalWidgetState: true });
});

test("rerenders with new value after setting new value", async () => {
  stubOpenAiGlobals({ widgetState: { globalWidgetState: true } });

  using _disabledAct = disableActEnvironment();
  const { takeSnapshot, getCurrentSnapshot } = await renderHookToSnapshotStream(
    () => useWidgetState()
  );

  {
    const [widgetState] = await takeSnapshot();

    expect(widgetState).toEqual({ globalWidgetState: true });
  }

  const [, setWidgetState] = getCurrentSnapshot();
  setWidgetState({ rerendered: true });

  {
    const [widgetState] = await takeSnapshot();

    expect(widgetState).toEqual({ rerendered: true });
  }
});

test("allows state setter function with previous value", async () => {
  stubOpenAiGlobals({ widgetState: { globalWidgetState: true } });

  using _disabledAct = disableActEnvironment();
  const { takeSnapshot, getCurrentSnapshot } = await renderHookToSnapshotStream(
    () => useWidgetState()
  );

  {
    const [widgetState] = await takeSnapshot();

    expect(widgetState).toEqual({ globalWidgetState: true });
  }

  const [, setWidgetState] = getCurrentSnapshot();
  setWidgetState((prev) => ({ ...prev, rerendered: true }));

  {
    const [widgetState] = await takeSnapshot();

    expect(widgetState).toEqual({ globalWidgetState: true, rerendered: true });
  }
});

test("updates value from window when changed globally", async () => {
  stubOpenAiGlobals({ widgetState: { globalWidgetState: true } });

  using _disabledAct = disableActEnvironment();
  const { takeSnapshot } = await renderHookToSnapshotStream(() =>
    useWidgetState()
  );

  {
    const [widgetState] = await takeSnapshot();

    expect(widgetState).toEqual({ globalWidgetState: true });
  }

  window.openai.setWidgetState({ fromEvent: true });

  {
    const [widgetState] = await takeSnapshot();

    expect(widgetState).toEqual({ fromEvent: true });
  }
});
