import { afterEach, expect, test, vi } from "vitest";
import {
  graphqlToolResult,
  minimalHostContextWithToolName,
  mockApplicationManifest,
  mockMcpHost,
  spyOnConsole,
  stubOpenAiGlobals,
} from "../../../../testing/internal/index.js";
import {
  disableActEnvironment,
  renderHookToSnapshotStream,
} from "@testing-library/react-render-stream";
import { useToolInfo } from "../useToolInfo.js";
import { ApolloClient } from "../../../core/ApolloClient.js";
import { InMemoryCache } from "@apollo/client";
import { Suspense } from "react";
import { ApolloProvider } from "../../../../react/ApolloProvider.js";

afterEach(() => {
  vi.unstubAllGlobals();
});

test("returns tool name and input combined", async () => {
  using _ = spyOnConsole("debug");
  stubOpenAiGlobals({ toolResponseMetadata: {}, toolInput: { id: "1" } });
  const client = new ApolloClient({
    cache: new InMemoryCache(),
    manifest: mockApplicationManifest(),
  });

  using host = await mockMcpHost({
    hostContext: minimalHostContextWithToolName("GetProduct"),
  });
  host.onCleanup(() => client.stop());

  host.sendToolInput({ arguments: { id: "1" } });
  host.sendToolResult(graphqlToolResult({ data: { product: null } }));

  using _disabledAct = disableActEnvironment();
  const { takeSnapshot } = await renderHookToSnapshotStream(
    () => useToolInfo(),
    {
      wrapper: ({ children }) => (
        <Suspense>
          <ApolloProvider client={client}>{children}</ApolloProvider>
        </Suspense>
      ),
    }
  );

  await expect(takeSnapshot()).resolves.toEqual({
    toolName: "GetProduct",
    toolInput: { id: "1" },
  });
  await expect(takeSnapshot).not.toRerender();
});

test("returns undefined when no tool call is active", async () => {
  using _ = spyOnConsole("debug");
  stubOpenAiGlobals({ toolResponseMetadata: {} });
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
    () => useToolInfo(),
    {
      wrapper: ({ children }) => (
        <Suspense>
          <ApolloProvider client={client}>{children}</ApolloProvider>
        </Suspense>
      ),
    }
  );

  await expect(takeSnapshot()).resolves.toBeUndefined();
  await expect(takeSnapshot).not.toRerender();
});

test("returns undefined toolInput when toolInput is not provided", async () => {
  using _ = spyOnConsole("debug");
  stubOpenAiGlobals({ toolResponseMetadata: {} });
  const client = new ApolloClient({
    cache: new InMemoryCache(),
    manifest: mockApplicationManifest(),
  });

  using host = await mockMcpHost({
    hostContext: minimalHostContextWithToolName("GetProduct"),
  });
  host.onCleanup(() => client.stop());

  host.sendToolInput({ arguments: {} });
  host.sendToolResult(graphqlToolResult({ data: { product: null } }));

  using _disabledAct = disableActEnvironment();
  const { takeSnapshot } = await renderHookToSnapshotStream(
    () => useToolInfo(),
    {
      wrapper: ({ children }) => (
        <Suspense>
          <ApolloProvider client={client}>{children}</ApolloProvider>
        </Suspense>
      ),
    }
  );

  await expect(takeSnapshot()).resolves.toEqual({
    toolName: "GetProduct",
    toolInput: undefined,
  });
  await expect(takeSnapshot).not.toRerender();
});
