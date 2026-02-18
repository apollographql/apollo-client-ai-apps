export const Platform = Object.freeze({
  target: "openai",
  select<
    T = unknown,
    TReturn = T extends (...args: any[]) => infer TReturn ? TReturn : T,
  >(config: { mcp?: T; openai?: T }): TReturn | undefined {
    const value = config.openai;

    return typeof value === "function" ? value() : (value as TReturn);
  },
});
