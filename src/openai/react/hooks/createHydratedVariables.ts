import { useState, useCallback, useRef, useMemo, useLayoutEffect } from "react";
import { Kind } from "graphql";
import type {
  DocumentNode,
  OperationVariables,
  TypedDocumentNode,
} from "@apollo/client";
import { useApolloClient } from "./useApolloClient.js";
import { useToolName } from "./useToolName.js";
import { isReactive } from "../../../react/reactive.js";
import type { Reactive } from "../../../react/reactive.js";
import { getOperationDefinition } from "@apollo/client/utilities/internal";
import { equal } from "@wry/equality";

type HydratedVariablesInput<TVariables> = {
  [K in keyof TVariables]: TVariables[K] | Reactive<TVariables[K]>;
};

type StateVariables<TVariables, Input> = {
  [K in keyof TVariables as K extends keyof Input ?
    Input[K] extends Reactive<any> ?
      never
    : K
  : K]: K extends keyof TVariables ? TVariables[K] : never;
};

type SetVariables<TState> = (
  update: Partial<TState> | ((prev: TState) => Partial<TState>)
) => void;

export function createHydratedVariables<
  TVariables extends OperationVariables = OperationVariables,
>(document: TypedDocumentNode<any, TVariables> | DocumentNode) {
  const operationDef = getOperationDefinition(document);

  const documentToolNames = new Set(
    operationDef?.directives
      ?.filter((d) => d.name.value === "tool")
      .flatMap((d) => {
        const nameArg = d.arguments?.find((arg) => arg.name.value === "name");
        return nameArg?.value.kind === Kind.STRING ? [nameArg.value.value] : [];
      })
  );

  const variableNames = new Set(
    operationDef?.variableDefinitions?.map((v) => v.variable.name.value) ?? []
  );

  function useHydratedVariables<
    TInputVariables extends HydratedVariablesInput<TVariables>,
  >(
    variables: TInputVariables &
      Record<Exclude<keyof TInputVariables, keyof TVariables>, never>
  ): [
    variables: TVariables,
    setVariables: SetVariables<StateVariables<TVariables, TInputVariables>>,
  ] {
    const client = useApolloClient();
    const toolName = useToolName();
    const [toolInput] = useState(() => client.takeToolInput());

    const toolMatches =
      toolInput !== undefined &&
      toolName !== undefined &&
      documentToolNames.has(toolName);

    const [stateVars, setStateVars] = useState<Record<string, unknown>>(() => {
      const initial: Record<string, unknown> = {};

      for (const [key, value] of Object.entries(
        toolMatches ? toolInput : variables
      )) {
        if (variableNames.has(key) && !isReactive(value)) {
          initial[key] = value;
        }
      }

      return initial;
    });

    const [initialReactiveValues] = useState<Record<string, unknown>>(() => {
      const initial: Record<string, unknown> = {};

      for (const [key, value] of Object.entries(variables)) {
        if (variableNames.has(key) && isReactive(value)) {
          initial[key] = value.value;
        }
      }

      return initial;
    });

    const changedKeysRef = useRef(new Set<string>());

    const activeReactive: Record<string, unknown> = {};
    const nextReactive: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(variables)) {
      if (!variableNames.has(key) || !isReactive(value)) {
        continue;
      }

      const useInputValue =
        changedKeysRef.current.has(key) ||
        !equal(value.value, initialReactiveValues[key]);

      if (toolMatches && !useInputValue) {
        if (key in toolInput!) {
          nextReactive[key] = toolInput![key];
          activeReactive[key] = toolInput![key];
        } else {
          nextReactive[key] = value.value; // tracked for dep stability, but not merged
        }
      } else {
        nextReactive[key] = value.value;
        activeReactive[key] = value.value;
      }
    }

    useLayoutEffect(() => {
      for (const [key, value] of Object.entries(variables)) {
        if (
          variableNames.has(key) &&
          // short-circuit deep equality check if we've already recorded key as changed
          !changedKeysRef.current.has(key) &&
          isReactive(value) &&
          !equal(value.value, initialReactiveValues[key])
        ) {
          changedKeysRef.current.add(key);
        }
      }
    });

    // eslint-disable-next-line react-hooks/exhaustive-deps
    const resolvedVariables = useMemo(() => {
      return { ...stateVars, ...activeReactive } as TVariables;
    }, [stateVars, ...Object.values(nextReactive)]);

    const setVariables = useCallback<
      SetVariables<StateVariables<TVariables, TInputVariables>>
    >((update) => {
      setStateVars((prev) => {
        const updates =
          typeof update === "function" ? update(prev as any) : update;
        return { ...prev, ...updates };
      });
    }, []);

    return [resolvedVariables, setVariables];
  }

  return { useHydratedVariables };
}
