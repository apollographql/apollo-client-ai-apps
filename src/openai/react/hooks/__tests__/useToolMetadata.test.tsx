import { afterEach, expect, test, vi } from "vitest";
import {
  mockApplicationManifest,
  mockMcpHost,
  spyOnConsole,
  stubOpenAiGlobals,
} from "../../../../testing/internal/index.js";
import {
  disableActEnvironment,
  renderHookToSnapshotStream,
} from "@testing-library/react-render-stream";
import { useToolMetadata } from "../useToolMetadata.js";
import { ApolloClient } from "../../../core/ApolloClient.js";
import { InMemoryCache } from "@apollo/client";
import { Suspense } from "react";
import { ApolloProvider } from "../../../../react/ApolloProvider.js";

afterEach(() => {
  vi.unstubAllGlobals();
});

test("returns the tool metadata from window.openai", async () => {
  using _ = spyOnConsole("debug");
  stubOpenAiGlobals({ toolResponseMetadata: { foo: true } });
  const client = new ApolloClient({
    cache: new InMemoryCache(),
    manifest: mockApplicationManifest(),
  });

  using host = await mockMcpHost();
  host.onCleanup(() => client.stop());

  host.sendToolInput({ arguments: {} });
  host.sendToolResult({
    content: [],
    structuredContent: {},
  });

  using _disabledAct = disableActEnvironment();
  const { takeSnapshot } = await renderHookToSnapshotStream(
    () => useToolMetadata(),
    {
      wrapper: ({ children }) => (
        <Suspense>
          <ApolloProvider client={client}>{children}</ApolloProvider>
        </Suspense>
      ),
    }
  );

  await expect(takeSnapshot()).resolves.toEqual({ foo: true });
  await expect(takeSnapshot).not.toRerender();
});

test("returns null when not set", async () => {
  using _ = spyOnConsole("debug");
  stubOpenAiGlobals();
  const client = new ApolloClient({
    cache: new InMemoryCache(),
    manifest: mockApplicationManifest(),
  });

  using host = await mockMcpHost();
  host.onCleanup(() => client.stop());

  host.sendToolInput({ arguments: {} });
  host.sendToolResult({
    content: [],
    structuredContent: {},
  });

  using _disabledAct = disableActEnvironment();
  const { takeSnapshot } = await renderHookToSnapshotStream(
    () => useToolMetadata(),
    {
      wrapper: ({ children }) => (
        <Suspense>
          <ApolloProvider client={client}>{children}</ApolloProvider>
        </Suspense>
      ),
    }
  );

  await expect(takeSnapshot()).resolves.toBeNull();
  await expect(takeSnapshot).not.toRerender();
});
