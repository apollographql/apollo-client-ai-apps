// NOTE: This is a simplified cache function that does not handles variances in
// arguments. For a more robust implementation, we would want to consider
// caching based on input so it works more similarly to a memoization cache. For
// that we can use `@sry/trie`. That is overkill for our use now, but if this
// needs to be more robust later, let's implement the cache with that package.
export function cacheAsync<TArgs extends any[], TReturn>(
  fn: (...args: TArgs) => Promise<TReturn>
) {
  let promise: Promise<TReturn> | undefined;

  return Object.assign(
    (...args: TArgs): Promise<TReturn> => {
      if (promise) {
        return promise;
      }

      return (promise = fn(...args));
    },
    {
      reset: () => {
        promise = undefined;
      },
    }
  );
}
