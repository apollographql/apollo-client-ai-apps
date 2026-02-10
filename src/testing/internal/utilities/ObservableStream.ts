/**
 * Adapted from
 * https://github.com/apollographql/apollo-client/blob/1d165ba37eca7e5d667055553aacc4c26be56065/src/testing/internal/ObservableStream.ts
 */
import {
  ReadableStream,
  type ReadableStreamDefaultReader,
} from "node:stream/web";
import type { Observable, Subscribable, Unsubscribable } from "rxjs";
import { expect } from "vitest";
import { equals, iterableEquality, JEST_MATCHERS_OBJECT } from "@vitest/expect";
import { printDiffOrStringify } from "@vitest/utils/diff";

export interface TakeOptions {
  timeout?: number;
}
type ObservableEvent<T> =
  | { type: "next"; value: T }
  | { type: "error"; error: any }
  | { type: "complete" };

function formatMessage(
  expected: ObservableEvent<any>,
  actual: ObservableEvent<any>
) {
  return printDiffOrStringify(expected, actual, { expand: true });
}

export class EventMismatchError extends Error {
  static is(error: unknown): error is EventMismatchError {
    return error instanceof Error && error.name === "EventMismatchError";
  }

  constructor(expected: ObservableEvent<any>, actual: ObservableEvent<any>) {
    super(formatMessage(expected, actual));
    this.name = "EventMismatchError";

    Object.setPrototypeOf(this, EventMismatchError.prototype);
  }
}

export class ObservableStream<T> {
  private reader: ReadableStreamDefaultReader<ObservableEvent<T>>;
  private subscription!: Unsubscribable;
  private readerQueue: Array<Promise<ObservableEvent<T>>> = [];

  constructor(observable: Observable<T> | Subscribable<T>) {
    this.unsubscribe = this.unsubscribe.bind(this);
    this.reader = new ReadableStream<ObservableEvent<T>>({
      start: (controller) => {
        this.subscription = observable.subscribe({
          next: (value) => controller.enqueue({ type: "next", value }),
          error: (error) => controller.enqueue({ type: "error", error }),
          complete: () => controller.enqueue({ type: "complete" }),
        });
      },
    }).getReader();
  }

  peek({ timeout = 100 }: TakeOptions = {}) {
    // Calling `peek` multiple times in a row should not advance the reader
    // multiple times until this value has been consumed.
    let readerPromise = this.readerQueue[0];

    if (!readerPromise) {
      // Since this.reader.read() advances the reader in the stream, we don't
      // want to consume this promise entirely, otherwise we will miss it when
      // calling `take`. Instead, we push it into a queue that can be consumed
      // by `take` the next time its called so that we avoid advancing the
      // reader until we are finished processing all peeked values.
      readerPromise = this.readNextValue();
      this.readerQueue.push(readerPromise);
    }

    return Promise.race([
      readerPromise,
      new Promise<ObservableEvent<T>>((_, reject) => {
        setTimeout(
          reject,
          timeout,
          new Error("Timeout waiting for next event")
        );
      }),
    ]);
  }

  take({ timeout = 100 }: TakeOptions = {}) {
    return Promise.race([
      this.readerQueue.shift() || this.readNextValue(),
      new Promise<ObservableEvent<T>>((_, reject) => {
        setTimeout(
          reject,
          timeout,
          new Error("Timeout waiting for next event")
        );
      }),
    ]).then((value) => {
      if (value.type === "next") {
        this.current = value.value;
      }
      return value;
    });
  }

  [Symbol.dispose]() {
    this.unsubscribe();
  }

  unsubscribe() {
    this.subscription.unsubscribe();
  }

  async takeNext(options?: TakeOptions): Promise<T> {
    const event = await this.take(options);
    if (event.type !== "next") {
      throw new EventMismatchError(
        { type: "next", value: expect.anything() },
        event
      );
    }
    return (event as ObservableEvent<T> & { type: "next" }).value;
  }

  async takeError(options?: TakeOptions): Promise<any> {
    const event = await this.take(options);
    validateEquals(event, { type: "error", error: expect.anything() });
    return (event as ObservableEvent<T> & { type: "error" }).error;
  }

  async takeComplete(options?: TakeOptions): Promise<void> {
    const event = await this.take(options);
    validateEquals(event, { type: "complete" });
  }

  private async readNextValue() {
    return this.reader.read().then((result) => result.value!);
  }

  private current?: T;
  getCurrent() {
    return this.current;
  }
}

// Lightweight expect(...).toEqual(...) check that avoids using `expect` so that
// `expect.assertions(num)` does not double count assertions when using the take*
// functions inside of expect(stream).toEmit* matchers.
function validateEquals(
  actualEvent: ObservableEvent<any>,
  expectedEvent: ObservableEvent<any>
) {
  // Uses the same matchers as expect(...).toEqual(...)
  // https://github.com/vitest-dev/vitest/blob/438c44e7fb8f3a6a36db8ff504f852c01963ba88/packages/expect/src/jest-expect.ts#L107-L110
  const isEqual = equals(actualEvent, expectedEvent, [
    ...getCustomEqualityTesters(),
    iterableEquality,
  ]);

  if (!isEqual) {
    throw new EventMismatchError(expectedEvent, actualEvent);
  }
}

// https://github.com/vitest-dev/vitest/blob/438c44e7fb8f3a6a36db8ff504f852c01963ba88/packages/expect/src/jest-matcher-utils.ts#L157-L159
function getCustomEqualityTesters() {
  return (globalThis as any)[JEST_MATCHERS_OBJECT].customEqualityTesters;
}
