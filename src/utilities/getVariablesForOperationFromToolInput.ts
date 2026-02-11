import type { OperationVariables } from "@apollo/client";
import type { ManifestOperation } from "../index.mcp";

// We need to get the variables used as part of the tool call that resulted in
// rendering this app so that we can properly write to the cache, however we
// want to only include keys that are defined as part of the operation in case
// additional input was provided to the tool.

/** @internal */
export function getVariablesForOperationFromToolInput(
  operation: ManifestOperation,
  toolInput: Record<string, unknown> | undefined
): OperationVariables {
  if (!operation.variables || !toolInput) {
    return {};
  }

  const variableNames = new Set(Object.keys(operation.variables));

  return Object.keys(toolInput).reduce((obj, key) => {
    if (variableNames.has(key)) {
      obj[key] = toolInput[key];
    }

    return obj;
  }, {} as OperationVariables);
}
