import { SetStateAction, useCallback, useState } from "react";
import { UnknownObject } from "../types/openai";
import { useOpenAiGlobal } from "./useOpenAiGlobal";

export function useWidgetState<T extends UnknownObject>(
  defaultState: T | (() => T)
): readonly [T, (state: SetStateAction<T>) => void];

export function useWidgetState<T extends UnknownObject>(
  defaultState?: T | (() => T | null) | null
): readonly [T | null, (state: SetStateAction<T | null>) => void];

export function useWidgetState<T extends UnknownObject>(
  defaultState?: T | (() => T | null) | null
): readonly [T | null, (state: SetStateAction<T | null>) => void] {
  const widgetStateFromWindow = useOpenAiGlobal("widgetState") as T;
  const [previousWidgetStateFromWindow, setPreviousWidgetStateFromWindow] =
    useState(widgetStateFromWindow);

  let [widgetState, _setWidgetState] = useState<T | null>(() => {
    if (widgetStateFromWindow != null) {
      return widgetStateFromWindow;
    }

    return typeof defaultState === "function" ? defaultState() : (
        (defaultState ?? null)
      );
  });

  if (previousWidgetStateFromWindow !== widgetStateFromWindow) {
    _setWidgetState((widgetState = widgetStateFromWindow));
    setPreviousWidgetStateFromWindow(widgetStateFromWindow);
  }

  const setWidgetState = useCallback((state: SetStateAction<T | null>) => {
    _setWidgetState((prevState) => {
      const newState = typeof state === "function" ? state(prevState) : state;

      if (newState != null && typeof window !== "undefined") {
        void window.openai?.setWidgetState?.(newState);
      }

      return newState;
    });
  }, []);

  return [widgetState, setWidgetState];
}
