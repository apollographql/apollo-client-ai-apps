// Polyfill for the `Promise.withResolvers` API:
// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise/withResolvers
//
// Once `Promise.withResolvers` hits widely available, we should remove this
// polyfill in favor of that API.

/** @internal */
export function promiseWithResolvers<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: any) => void;

  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return { promise, resolve, reject };
}
