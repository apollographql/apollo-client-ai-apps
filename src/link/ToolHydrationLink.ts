import { ApolloLink, Observable } from "@apollo/client";
import type { OperationVariables } from "@apollo/client";
import { canonicalStringify } from "@apollo/client/utilities";
import type { FormattedExecutionResult } from "graphql";
import { of } from "rxjs";

export interface HydrationData {
  operationName: string;
  result: FormattedExecutionResult;
  variables?: OperationVariables;
}

interface PendingEntry {
  resolve: () => void;
}

/**
 * @internal
 * Holds requests until the client is fully hydrated after a tool call. It is
 * particularly useful for `network-only` and `cache-and-network` fetch policies
 * where the request makes it to the link chain because it prevents a followup
 * tool call to the MCP server for the just fetched data from the MCP server.
 */
export class ToolHydrationLink extends ApolloLink {
  #hydrated = false;
  #pending: PendingEntry[] = [];
  #hydratedOperations = new Map<string, FormattedExecutionResult>();

  complete(operations: HydrationData[]): void {
    for (const { operationName, result, variables } of operations) {
      this.#hydratedOperations.set(makeKey(operationName, variables), result);
    }
    this.#hydrated = true;

    const pending = this.#pending.splice(0);
    for (const { resolve } of pending) {
      resolve();
    }
  }

  request(
    operation: ApolloLink.Operation,
    forward: ApolloLink.ForwardFunction
  ): Observable<ApolloLink.Result> {
    if (this.#hydrated) {
      return this.#tryServeHydrated(operation, forward);
    }

    return new Observable((observer) => {
      let active = true;
      const entry: PendingEntry = {
        resolve: () => {
          if (!active) return;
          this.#tryServeHydrated(operation, forward).subscribe(observer);
        },
      };
      this.#pending.push(entry);

      return () => {
        active = false;
        const idx = this.#pending.indexOf(entry);
        if (idx !== -1) this.#pending.splice(idx, 1);
      };
    });
  }

  #tryServeHydrated(
    operation: ApolloLink.Operation,
    forward: ApolloLink.ForwardFunction
  ): Observable<ApolloLink.Result> {
    const key = makeKey(operation.operationName, operation.variables);
    const result = this.#hydratedOperations.get(key);

    if (result !== undefined) {
      this.#hydratedOperations.delete(key);
      return of(result);
    }

    return forward(operation);
  }
}

function makeKey(
  operationName: string | undefined,
  variables?: OperationVariables
): string {
  return `${operationName}:${canonicalStringify(variables ?? {})}`;
}
