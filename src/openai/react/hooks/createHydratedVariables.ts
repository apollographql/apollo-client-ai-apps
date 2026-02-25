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
import { __DEV__ } from "@apollo/client/utilities/environment";

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

/** @experimental */
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
      const values: Record<string, unknown> = {};

      for (const [key, value] of Object.entries(
        toolMatches ? toolInput : variables
      )) {
        if (variableNames.has(key) && !isReactive(value)) {
          values[key] = value;
        }
      }

      return values;
    });

    const [initialReactiveValues] = useState<Record<string, unknown>>(() => {
      const values: Record<string, unknown> = {};

      for (const [key, value] of Object.entries(variables)) {
        if (variableNames.has(key) && isReactive(value)) {
          values[key] = value.value;
        }
      }

      return values;
    });

    const [reactiveVars, setReactiveVars] = useState(() => {
      const values: Record<string, unknown> = {};

      for (const [key, value] of Object.entries(initialReactiveValues)) {
        if (toolMatches && key in toolInput) {
          values[key] = toolInput[key];
        } else if (!toolMatches) {
          values[key] = value;
        }
      }

      return values;
    });

    const changedKeysRef = useRef(new Set<string>());
    const nextReactiveVars: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(variables)) {
      if (!variableNames.has(key) || !isReactive(value)) continue;

      const hasChanged =
        changedKeysRef.current.has(key) ||
        !equal(value.value, initialReactiveValues[key]);

      if (toolMatches && !hasChanged) {
        if (key in toolInput) {
          nextReactiveVars[key] = toolInput[key];
        }
      } else {
        nextReactiveVars[key] = value.value;
      }
    }

    if (!equal(nextReactiveVars, reactiveVars)) {
      setReactiveVars(nextReactiveVars);
    }

    useLayoutEffect(() => {
      for (const [key, value] of Object.entries(variables)) {
        if (
          variableNames.has(key) &&
          isReactive(value) &&
          !changedKeysRef.current.has(key) &&
          !equal(value.value, initialReactiveValues[key])
        ) {
          changedKeysRef.current.add(key);
        }
      }
    });

    const resolvedVariables = useMemo(() => {
      return { ...stateVars, ...reactiveVars } as TVariables;
    }, [stateVars, reactiveVars]);

    const setVariables = useCallback<
      SetVariables<StateVariables<TVariables, TInputVariables>>
    >((update) => {
      setStateVars((prev) => {
        const updates =
          typeof update === "function" ? update(prev as any) : update;

        const filtered = Object.fromEntries(
          Object.entries(updates).filter(([key]) => {
            if (key in initialReactiveValues) {
              if (__DEV__) {
                console.warn(
                  `Attempted to set reactive variable "${key}" via setVariables. ` +
                    `Reactive variables are read-only and are ignored. `
                );
              }
              return false;
            }
            return true;
          })
        );

        if (Object.keys(filtered).length === 0) return prev;

        return { ...prev, ...filtered };
      });
    }, []);

    return [resolvedVariables, setVariables];
  }

  return { useHydratedVariables };
}
