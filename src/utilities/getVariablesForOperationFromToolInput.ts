import type { OperationVariables } from "@apollo/client";
import type { ManifestOperation } from "../types/application-manifest.js";

// We need to get the variables used as part of the tool call that resulted in
// rendering this app so that we can properly write to the cache, however we
// want to only include keys that are defined as part of the operation in case
// additional input was provided to the tool.

function coerceVariable(value: unknown, typeName: string): unknown {
  const baseType = typeName.replace(/[!\[\]]/g, "");

  switch (baseType) {
    case "Int":
    case "Float": {
      const num = Number(value);
      return Number.isNaN(num) ? value : num;
    }
    case "Boolean":
      if (typeof value === "string") {
        return value.toLowerCase() === "true";
      }
      return value;
    default:
      return value;
  }
}

/** @internal */
export function getVariablesForOperationFromToolInput(
  operation: ManifestOperation,
  toolInput: Record<string, unknown> | undefined
): OperationVariables {
  if (!operation.variables || !toolInput) {
    return {};
  }

  const variableTypes = operation.variables;

  return Object.keys(toolInput).reduce((obj, key) => {
    if (key in variableTypes) {
      obj[key] = coerceVariable(toolInput[key], variableTypes[key]);
    }

    return obj;
  }, {} as OperationVariables);
}
