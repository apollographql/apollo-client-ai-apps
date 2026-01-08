import type { NextRenderOptions } from "@testing-library/react-render-stream";

interface CustomMatchers<R = unknown> {
  toRerender: (options?: NextRenderOptions) => Promise<R>;
}

declare module "vitest" {
  interface Assertion<T = any> extends CustomMatchers<T> {}
}
