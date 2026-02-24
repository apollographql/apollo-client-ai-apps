import { useState, useCallback } from "react";
import { Kind } from "graphql";
import type { OperationDefinitionNode } from "graphql";
import type {
  DocumentNode,
  OperationVariables,
  TypedDocumentNode,
} from "@apollo/client";
import { useToolInput } from "./useToolInput.js";
import { useToolName } from "./useToolName.js";

type SetVariables<TVariables extends OperationVariables> = (
  update: Partial<TVariables> | ((prev: TVariables) => Partial<TVariables>)
) => void;

export function useToolInputVariables<
  TVariables extends OperationVariables = OperationVariables,
>(
  document: TypedDocumentNode<any, TVariables> | DocumentNode,
  defaultVariables: NoInfer<TVariables>
): [TVariables, SetVariables<TVariables>] {
  const toolName = useToolName();
  const toolInput = useToolInput();

  const [variables, setVariablesState] = useState<TVariables>(() => {
    if (toolInput === undefined) {
      return defaultVariables;
    }

    const operationDef = document.definitions.find(
      (def): def is OperationDefinitionNode =>
        def.kind === Kind.OPERATION_DEFINITION
    );

    const toolDirective = operationDef?.directives?.find(
      (d) => d.name.value === "tool"
    );
    const nameArg = toolDirective?.arguments?.find(
      (arg) => arg.name.value === "name"
    );
    const documentToolName =
      nameArg?.value.kind === Kind.STRING ? nameArg.value.value : undefined;

    if (!documentToolName || toolName !== documentToolName) {
      return defaultVariables;
    }

    const variableNames = new Set(
      operationDef?.variableDefinitions?.map(
        (varDef) => varDef.variable.name.value
      )
    );

    return Object.fromEntries(
      Object.entries(toolInput).filter(([key]) => variableNames.has(key))
    ) as TVariables;
  });

  const setVariables = useCallback<SetVariables<TVariables>>((update) => {
    setVariablesState((prev) => {
      const value = typeof update === "function" ? update(prev) : update;
      return { ...prev, ...value };
    });
  }, []);

  return [variables, setVariables];
}
