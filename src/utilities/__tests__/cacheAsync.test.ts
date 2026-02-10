import { test, expect, vi } from "vitest";
import { cacheAsync } from "../cacheAsync.js";

test("returns the same promise on subsequent calls", async () => {
  const fn = vi.fn(() => Promise.resolve("result"));
  const cached = cacheAsync(fn);

  const p1 = cached();
  const p2 = cached();

  expect(p1).toBe(p2);
  expect(fn).toHaveBeenCalledTimes(1);
  await expect(p1).resolves.toBe("result");
});

test("reset allows the function to be called again", async () => {
  let count = 0;
  const fn = vi.fn(() => Promise.resolve(++count));
  const cached = cacheAsync(fn);

  await expect(cached()).resolves.toBe(1);

  cached.reset();

  await expect(cached()).resolves.toBe(2);
  expect(fn).toHaveBeenCalledTimes(2);
});

test("passes arguments to the wrapped function", async () => {
  const fn = vi.fn((a: number, b: string) => Promise.resolve(`${a}-${b}`));
  const cached = cacheAsync(fn);

  await expect(cached(1, "hello")).resolves.toBe("1-hello");
  expect(fn).toHaveBeenCalledWith(1, "hello");
});

test("does not cache after reset even if prior promise is still pending", async () => {
  let resolve!: () => void;
  let count = 0;

  const fn = vi.fn(
    () =>
      new Promise<number>((res) => {
        resolve = () => res(++count);
      })
  );

  const cached = cacheAsync(fn);

  const p1 = cached();
  const resolveFirst = resolve;

  cached.reset();
  const p2 = cached();

  expect(p1).not.toBe(p2);
  expect(fn).toHaveBeenCalledTimes(2);

  resolveFirst();
  await expect(p1).resolves.toBe(1);

  resolve();
  await expect(p2).resolves.toBe(2);
});
