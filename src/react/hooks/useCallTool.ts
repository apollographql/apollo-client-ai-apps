type UseCallToolResult = <K>(
  toolId: string,
  variables?: Record<string, unknown> | undefined
) => Promise<K>;

export const useCallTool = (): UseCallToolResult => {
  const callTool = async (
    toolId: string,
    variables: Record<string, unknown> | undefined = {}
  ) => await window.openai?.callTool(toolId, variables);

  return callTool;
};
