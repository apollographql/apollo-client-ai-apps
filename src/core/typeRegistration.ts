export interface Register {}

export type ToolName =
  Register extends { toolName: infer T extends string } ? T : string;
