import { PLATFORM } from "#constants";

export const Platform = Object.freeze({
  target: PLATFORM,
  select<
    T = unknown,
    TReturn = T extends (...args: any[]) => infer TReturn ? TReturn : T,
  >(config: { mcp?: T; openai?: T }): TReturn | undefined {
    const value = PLATFORM in config ? config[PLATFORM] : undefined;

    return typeof value === "function" ? value() : (value as any);
  },
});
