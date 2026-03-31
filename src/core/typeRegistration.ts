export interface Register {}

type RegisteredToolInputs =
  Register extends { toolInputs: infer T extends Record<string, unknown> } ? T
  : never;

type ToolInfoFromInputs<T extends Record<string, unknown>> = {
  [K in keyof T]: {
    toolName: K;
    toolInput: T[K] extends Record<string, never> ? T[K] | undefined : T[K];
  };
}[keyof T];

export type ToolInfo =
  [RegisteredToolInputs] extends [never] ?
    { toolName: string; toolInput: Record<string, unknown> | undefined }
  : ToolInfoFromInputs<RegisteredToolInputs>;
