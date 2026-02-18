export function missingHook<HookFn extends (...args: any[]) => any>(
  name: string
) {
  return (() => {
    throw new Error(
      `Cannot use the '${name}' hook without export conditions. Please set export conditions or import from the \`/openai\` or \`/mcp\` subpath directly.`
    );
  }) as unknown as HookFn;
}
