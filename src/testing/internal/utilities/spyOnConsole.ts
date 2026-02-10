import { vi, type Mock } from "vitest";

const noop = () => {};

type ConsoleMethod = "log" | "info" | "warn" | "error" | "debug";

type Spies<Keys extends ConsoleMethod[]> = Record<
  Keys[number],
  Mock<(message?: any, ...args: any[]) => void>
>;

export function spyOnConsole<Keys extends ConsoleMethod[]>(
  ...spyOn: Keys
): Spies<Keys> & Disposable {
  const spies = {} as Spies<Keys>;
  for (const key of spyOn) {
    // @ts-ignore
    spies[key] = vi.spyOn(console, key).mockImplementation(noop);
  }

  return {
    ...spies,
    [Symbol.dispose]() {
      for (const spy of Object.values(spies) as Mock[]) {
        spy.mockRestore();
      }
    },
  };
}
