export interface Register {}

export type ToolName =
  Register extends { toolName: infer T extends string } ? T : string;

type RegisteredToolInputs =
  Register extends { toolInputs: infer T extends Record<string, unknown> }
    ? T
    : never;

export type ToolInput =
  [RegisteredToolInputs] extends [never]
    ? Record<string, unknown>
    : RegisteredToolInputs[keyof RegisteredToolInputs];
