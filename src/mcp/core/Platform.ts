export const Platform = Object.freeze({
  target: "mcp",
  select<
    T = unknown,
    TReturn = T extends (...args: any[]) => infer TReturn ? TReturn : T,
  >(config: { mcp?: T; openai?: T }): TReturn | undefined {
    const value = config.mcp;

    return typeof value === "function" ? value() : (value as TReturn);
  },
});
