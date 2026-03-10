export interface Register {}

export type ToolName =
  Register extends { toolName: infer T extends string } ? T : string;

type RegisteredToolInputs =
  Register extends { toolInputs: infer T extends Record<string, unknown> } ? T
  : never;

export type ToolInput =
  [RegisteredToolInputs] extends [never] ? Record<string, unknown>
  : RegisteredToolInputs[keyof RegisteredToolInputs];

type ToolInfoFromInputs<T extends Record<string, unknown>> = {
  [K in keyof T]: { toolName: K; toolInput: T[K] | undefined };
}[keyof T];

export type ToolInfo =
  [RegisteredToolInputs] extends [never] ?
    { toolName: string; toolInput: Record<string, unknown> | undefined }
  : ToolInfoFromInputs<RegisteredToolInputs>;
