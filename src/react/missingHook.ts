export function missingHook(name: string) {
  return () => {
    throw new Error(
      `Cannot use the '${name}' hook without export conditions. Please set export conditions or import from the \`/openai\` or \`/mcp\` subpath directly.`
    );
  };
}
