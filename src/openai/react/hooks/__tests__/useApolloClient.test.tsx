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
import { ApolloProvider } from "../../../../react/ApolloProvider.js";
import { stubOpenAiGlobals } from "../../../../testing/internal";
import { ErrorBoundary } from "react-error-boundary";

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
        <ApolloProvider client={client}>{children}</ApolloProvider>
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
        <ErrorBoundary fallback={<div />}>
          <ApolloProvider client={client as ApolloClient}>
            {children}
          </ApolloProvider>
        </ErrorBoundary>
      ),
    }
  );

  await expect(takeSnapshot()).resolves.toBe(client);
  await expect(takeSnapshot).not.toRerender();
});
