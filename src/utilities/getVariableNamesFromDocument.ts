import { getOperationDefinition } from "@apollo/client/utilities/internal";
import type { DocumentNode } from "graphql";

export function getVariableNamesFromDocument(document: DocumentNode) {
  const operationDef = getOperationDefinition(document);
  return new Set(
    operationDef?.variableDefinitions?.map((v) => v.variable.name.value) ?? []
  );
}
