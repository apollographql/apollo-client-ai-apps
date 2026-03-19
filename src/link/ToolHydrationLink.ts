import { ApolloLink, Observable } from "@apollo/client";
import type { OperationVariables } from "@apollo/client";
import { canonicalStringify } from "@apollo/client/utilities";
import type { FormattedExecutionResult } from "graphql";
import { of } from "rxjs";
import type { ManifestOperation } from "../types/application-manifest.js";

interface PendingEntry {
  resolve: () => void;
}

type OperationKey = string & { __type: "PendingKey" };

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
  #operations = new Map<OperationKey, FormattedExecutionResult>();

  hydrate(
    operation: ManifestOperation,
    {
      result,
      variables,
    }: { result: FormattedExecutionResult; variables: OperationVariables }
  ) {
    this.#operations.set(
      getKey({ operationName: operation.name, variables }),
      result
    );
  }

  complete(): void {
    this.#hydrated = true;

    for (const { resolve } of this.#pending.splice(0)) {
      resolve();
    }
  }

  request(
    operation: ApolloLink.Operation,
    forward: ApolloLink.ForwardFunction
  ): Observable<ApolloLink.Result> {
    const maybeSendToTerminatingLink = (): Observable<ApolloLink.Result> => {
      const key = getKey(operation);
      const result = this.#operations.get(key);

      if (result !== undefined) {
        this.#operations.delete(key);
        return of(result);
      }

      return forward(operation);
    };

    if (this.#hydrated) {
      return maybeSendToTerminatingLink();
    }

    return new Observable((observer) => {
      let active = true;
      const entry: PendingEntry = {
        resolve: () => {
          if (!active) return;
          maybeSendToTerminatingLink().subscribe(observer);
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
}

function getKey({
  operationName,
  variables,
}: {
  operationName: string | undefined;
  variables?: OperationVariables;
}): OperationKey {
  return `${operationName}:${canonicalStringify(variables ?? {})}` as OperationKey;
}
