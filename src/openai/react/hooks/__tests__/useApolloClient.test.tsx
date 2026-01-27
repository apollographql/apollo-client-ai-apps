import { expect, test } from "vitest";
import { useApolloClient } from "../useApolloClient";
import {
  ApolloLink,
  ApolloClient as BaseApolloClient,
  InMemoryCache,
} from "@apollo/client";
import { ApolloClient } from "../../../core/ApolloClient";
import type { ApplicationManifest } from "../../../../types/application-manifest";
import {
  disableActEnvironment,
  renderHookToSnapshotStream,
} from "@testing-library/react-render-stream";
import { ApolloProvider } from "../../ApolloProvider";
import { SET_GLOBALS_EVENT_TYPE } from "../../../types";
import { stubOpenAiGlobals } from "../../../../testing/internal";
import { useEffect, type ReactNode } from "react";

test("returns the `ApolloClient` instance in context", async () => {
  stubOpenAiGlobals();

  const client = new ApolloClient({
    cache: new InMemoryCache(),
    manifest: { operations: [] as any } as ApplicationManifest,
  });

  using _disabledAct = disableActEnvironment();
  const { takeSnapshot } = await renderHookToSnapshotStream(
    () => useApolloClient(),
    {
      wrapper: ({ children }) => (
        <MockGlobalEventOnMount>
          <ApolloProvider client={client}>{children}</ApolloProvider>
        </MockGlobalEventOnMount>
      ),
    }
  );

  await expect(takeSnapshot()).resolves.toBe(client);
  await expect(takeSnapshot).not.toRerender();
});

// This is failing because <ApolloProvider /> runs `client.prefetchData` which
// doesn't exist on the base client. This test documents the behavior for now.
test.fails("throws when providing base apollo client instance", async () => {
  stubOpenAiGlobals();

  const client = new BaseApolloClient({
    cache: new InMemoryCache(),
    link: ApolloLink.empty(),
  });

  using _disabledAct = disableActEnvironment();
  const { takeSnapshot } = await renderHookToSnapshotStream(
    () => useApolloClient(),
    {
      wrapper: ({ children }) => (
        <MockGlobalEventOnMount>
          <ApolloProvider client={client as ApolloClient}>
            {children}
          </ApolloProvider>
        </MockGlobalEventOnMount>
      ),
    }
  );

  await expect(takeSnapshot()).resolves.toBe(client);
  await expect(takeSnapshot).not.toRerender();
});

// Use a component w/ `useEffect` to trigger the global event to ensure the
// timing is roughly equivalent to mounting `ApolloProvider`.
function MockGlobalEventOnMount({ children }: { children: ReactNode }) {
  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent(SET_GLOBALS_EVENT_TYPE, { detail: { globals: {} } })
    );
  }, []);

  return children;
}
