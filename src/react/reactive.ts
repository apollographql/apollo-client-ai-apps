const REACTIVE = Symbol("apollo.reactive");

export interface Reactive<T> {
  readonly [REACTIVE]: true;
  readonly value: T;
}

export function reactive<T>(value: T): Reactive<T> {
  return { [REACTIVE]: true, value };
}

export function isReactive(value: unknown): value is Reactive<unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    REACTIVE in value &&
    (value as Record<symbol, unknown>)[REACTIVE] === true
  );
}
