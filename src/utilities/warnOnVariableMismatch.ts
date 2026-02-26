import type { DocumentNode, OperationVariables } from "@apollo/client";
import { getOperationName } from "@apollo/client/utilities/internal/internal.cjs";

export function warnOnVariableMismatch(
  document: DocumentNode,
  expected: OperationVariables,
  received: OperationVariables
) {
  const operationName = getOperationName(document, "(anonymous)");

  console.warn(
    `The operation "${operationName}" has a @tool directive matching the current tool call, but the ` +
      "variables don't match the tool input. Use the `useHydratedVariables` hook returned from `createHydrationUtils` " +
      "to provide the hydrated variables to the query. " +
      "\n\nExpected variables:\n%o\n\nReceived:\n%o",
    received,
    expected
  );
}
