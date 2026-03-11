export interface CacheAsyncOptions {
  /** Time in milliseconds before the cached result expires and the next call re-executes the function. */
  maxAge?: number;
}

// NOTE: This is a simplified cache function that does not handles variances in
// arguments. For a more robust implementation, we would want to consider
// caching based on input so it works more similarly to a memoization cache. For
// that we can use `@sry/trie`. That is overkill for our use now, but if this
// needs to be more robust later, let's implement the cache with that package.
export function cacheAsync<TArgs extends any[], TReturn>(
  fn: (...args: TArgs) => Promise<TReturn>,
  options: CacheAsyncOptions = {}
) {
  const { maxAge } = options;
  let promise: Promise<TReturn> | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const reset = () => {
    promise = undefined;
    if (timer !== undefined) {
      clearTimeout(timer);
      timer = undefined;
    }
  };

  return Object.assign(
    (...args: TArgs): Promise<TReturn> => {
      if (promise) {
        return promise;
      }

      promise = fn(...args);

      if (maxAge !== undefined) {
        promise.then(() => {
          timer = setTimeout(reset, maxAge);
        });
      }

      return promise;
    },
    { reset }
  );
}
