import { getOperationDefinition } from "@apollo/client/utilities/internal";
import { Kind, type DirectiveNode, type DocumentNode } from "graphql";

export function getToolNamesFromDocument(document: DocumentNode) {
  const operationDef = getOperationDefinition(document);
  const operationName = operationDef?.name?.value;
  const toolDirectives =
    operationDef?.directives?.filter((d) => d.name.value === "tool") ?? [];

  if (toolDirectives.length === 1) {
    return new Set([
      getToolNameFromDirective(toolDirectives[0]) ?? operationName,
    ]);
  }

  return new Set(
    toolDirectives.flatMap((d) => {
      const name = getToolNameFromDirective(d);
      return name ? [name] : [];
    })
  );
}

function getToolNameFromDirective(directive: DirectiveNode) {
  const nameArg = directive.arguments?.find((arg) => arg.name.value === "name");
  return nameArg?.value.kind === Kind.STRING ? nameArg.value.value : undefined;
}
