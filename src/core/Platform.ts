export const Platform = Object.freeze({
  target: "unknown",
  select<
    T = unknown,
    TReturn = T extends (...args: any[]) => infer TReturn ? TReturn : T,
  >(config: { mcp?: T; openai?: T }): TReturn | undefined {
    return;
  },
});
