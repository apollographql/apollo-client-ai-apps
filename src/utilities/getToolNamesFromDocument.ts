import { getOperationDefinition } from "@apollo/client/utilities/internal";
import { Kind, type DocumentNode } from "graphql";

export function getToolNamesFromDocument(document: DocumentNode) {
  const operationDef = getOperationDefinition(document);

  return new Set(
    operationDef?.directives
      ?.filter((d) => d.name.value === "tool")
      .flatMap((d) => {
        const nameArg = d.arguments?.find((arg) => arg.name.value === "name");
        return nameArg?.value.kind === Kind.STRING ? [nameArg.value.value] : [];
      })
  );
}
