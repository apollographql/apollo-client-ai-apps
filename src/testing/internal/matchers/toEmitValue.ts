import { iterableEquality } from "@jest/expect-utils";
import { expect } from "vitest";

import type { TakeOptions } from "../utilities/ObservableStream.js";
import {
  ObservableStream,
  EventMismatchError,
} from "../utilities/ObservableStream.js";

import { getSerializableProperties } from "../utilities/getSerializableProperties.js";

expect.extend({
  async toEmitValue(actual, expected, options: TakeOptions) {
    const stream = actual as ObservableStream<any>;
    const hint = this.utils.matcherHint("toEmitValue", "stream", "expected", {
      isNot: this.isNot,
    });

    try {
      const value = await stream.takeNext(options);
      const serializableProperties = getSerializableProperties(value);

      const pass = this.equals(
        serializableProperties,
        expected,
        // https://github.com/jestjs/jest/blob/22029ba06b69716699254bb9397f2b3bc7b3cf3b/packages/expect/src/matchers.ts#L62-L67
        [...this.customTesters, iterableEquality],
        true
      );

      return {
        pass,
        message: () => {
          if (pass) {
            return (
              hint +
              "\n\nExpected stream not to emit a fetch result equal to expected but it did."
            );
          }

          return (
            hint +
            "\n\n" +
            this.utils.printDiffOrStringify(serializableProperties, expected)
          );
        },
      };
    } catch (error) {
      if (
        error instanceof Error &&
        error.message === "Timeout waiting for next event"
      ) {
        return {
          pass: false,
          message: () =>
            hint + "\n\nExpected stream to emit a value but it did not.",
        };
      } else if (EventMismatchError.is(error)) {
        return {
          pass: false,
          message: () =>
            this.utils.matcherHint("toEmitNext", "stream", "expected") +
            "\n\n" +
            this.utils.printDiffOrStringify(error.actual, error.expected),
        };
      } else {
        throw error;
      }
    }
  },
});
