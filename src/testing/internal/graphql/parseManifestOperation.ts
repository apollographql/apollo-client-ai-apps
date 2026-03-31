import {
  Kind,
  print,
  visit,
  type DirectiveNode,
  type DocumentNode,
  type OperationDefinitionNode,
} from "graphql";
import type {
  ManifestOperation,
  ManifestTool,
} from "../../../types/application-manifest";
import {
  getOperationDefinition,
  removeDirectivesFromDocument,
} from "@apollo/client/utilities/internal";
import * as crypto from "node:crypto";
import {
  getDirectiveArgument,
  getTypeName,
  maybeGetArgumentValue,
} from "../../../vite/utilities/graphql.js";
import { invariant } from "../../../utilities/index.js";

export function parseManifestOperation(
  document: DocumentNode
): ManifestOperation {
  const operation = getOperationDefinition(document);
  invariant(operation, "Must provide an operation to the document");

  const variables: ManifestOperation["variables"] = {};
  const tools: ManifestTool[] = [];
  let prefetch = false;

  const modified = removeDirectivesFromDocument(
    [{ name: "prefetch" }, { name: "tool" }],
    visit(document, {
      Directive(node) {
        if (node.name.value === "tool") {
          tools.push(parseToolDefinition(node, operation));
        }
        prefetch ||= node.name.value === "prefetch";
      },
      VariableDefinition(node) {
        variables[node.variable.name.value] = getTypeName(node.type);
      },
    })
  )!;

  const body = print(modified);
  const hash = crypto.createHash("sha256").update(body).digest("hex");

  const manifestOperation: ManifestOperation = {
    id: hash,
    name: operation.name!.value,
    body,
    type: operation.operation as "query" | "mutation",
    prefetch,
    variables,
    tools,
  };

  if (prefetch) {
    manifestOperation.prefetchID = "__anonymous";
  }

  return manifestOperation;
}

function parseToolDefinition(
  directive: DirectiveNode,
  operation: OperationDefinitionNode
): ManifestTool {
  const nameArg = maybeGetArgumentValue(
    getDirectiveArgument("name", directive),
    Kind.STRING
  );
  const descriptionArg = maybeGetArgumentValue(
    getDirectiveArgument("description", directive),
    Kind.STRING
  );

  return {
    name: nameArg ?? operation.name!.value,
    description: descriptionArg ?? operation.description!.value,
  };
}
