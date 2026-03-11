export interface Register {}

/**
 * @deprecated Please use the `ToolInfo` type instead. `ToolName` will be
 * removed in the next major version.
 */
export type ToolName =
  Register extends { toolName: infer T extends string } ? T : string;

type RegisteredToolInputs =
  Register extends { toolInputs: infer T extends Record<string, unknown> } ? T
  : never;

/**
 * @deprecated Please use the `ToolInfo` type instead. `ToolInput` will be
 * removed in the next major version.
 */
export type ToolInput =
  [RegisteredToolInputs] extends [never] ? Record<string, unknown>
  : RegisteredToolInputs[keyof RegisteredToolInputs];

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
