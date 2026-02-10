import type { NextRenderOptions } from "@testing-library/react-render-stream";
import type { TakeOptions } from "../utilities/ObservableStream.js";

interface CustomMatchers<R = unknown> {
  toRerender: (options?: NextRenderOptions) => Promise<R>;
  toComplete: (options?: TakeOptions) => Promise<R>;
  toEmitValue: (expected: unknown, options?: TakeOptions) => Promise<R>;
}

declare module "vitest" {
  interface Assertion<T = any> extends CustomMatchers<T> {}
}
