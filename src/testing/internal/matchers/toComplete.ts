import { expect } from "vitest";

import type {
  ObservableStream,
  TakeOptions,
} from "../utilities/ObservableStream.js";
import { EventMismatchError } from "../utilities/ObservableStream.js";

expect.extend({
  async toComplete(actual, options?: TakeOptions) {
    const stream = actual as ObservableStream<any>;
    const hint = this.utils.matcherHint("toComplete", "stream", "");

    try {
      await stream.takeComplete(options);

      return {
        pass: true,
        message: () => {
          return hint + "\n\nExpected stream not to complete but it did.";
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
            hint + "\n\nExpected stream to complete but it did not.",
        };
      } else if (EventMismatchError.is(error)) {
        return {
          pass: false,
          message: () =>
            hint +
            "\n\n" +
            this.utils.printDiffOrStringify(error.actual, error.expected),
        };
      } else {
        throw error;
      }
    }
  },
});
