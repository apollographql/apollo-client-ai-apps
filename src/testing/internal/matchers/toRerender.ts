// Vitest port of toRerender from
// https://github.com/testing-library/react-render-stream-testing-library/blob/main/src/expect/renderStreamMatchers.ts
import type {
  Assertable,
  NextRenderOptions,
  RenderStream,
} from "@testing-library/react-render-stream";
import { WaitForRenderTimeoutError } from "@testing-library/react-render-stream";

import { expect } from "vitest";

const assertableSymbol = Symbol.for(
  "@testing-library/react-render-stream:assertable"
);

expect.extend({
  async toRerender(actual, options: NextRenderOptions) {
    const _stream = actual as RenderStream<any> | Assertable;
    const stream = (
      assertableSymbol in _stream ?
        _stream[assertableSymbol]
      : _stream) as RenderStream<any>;
    const hint = this.utils.matcherHint("toRerender", undefined, undefined, {
      isNot: this.isNot,
    });

    let pass = true;

    try {
      await stream.peekRender({ timeout: 100, ...options });
    } catch (e) {
      if (e instanceof WaitForRenderTimeoutError) {
        pass = false;
      } else {
        throw e;
      }
    }

    return {
      pass,
      message() {
        return (
          `${hint}\n\nExpected component to${pass ? " not" : ""} rerender, ` +
          `but it did${pass ? "" : " not"}.`
        );
      },
    };
  },
});
