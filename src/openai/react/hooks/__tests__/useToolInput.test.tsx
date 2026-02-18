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
import { useToolInput } from "../useToolInput.js";
import { ApolloClient } from "../../../core/ApolloClient.js";
import { InMemoryCache } from "@apollo/client";
import { Suspense } from "react";
import { ApolloProvider } from "../../../../react/ApolloProvider.js";

afterEach(() => {
  vi.unstubAllGlobals();
});

test("returns the tool input from the MCP host", async () => {
  using _ = spyOnConsole("debug");
  stubOpenAiGlobals({ toolResponseMetadata: {} });
  const client = new ApolloClient({
    cache: new InMemoryCache(),
    manifest: mockApplicationManifest(),
  });

  using host = await mockMcpHost();
  host.onCleanup(() => client.stop());

  host.sendToolInput({ arguments: { id: "1" } });
  host.sendToolResult({
    content: [],
    structuredContent: {},
  });

  using _disabledAct = disableActEnvironment();
  const { takeSnapshot } = await renderHookToSnapshotStream(
    () => useToolInput(),
    {
      wrapper: ({ children }) => (
        <Suspense>
          <ApolloProvider client={client}>{children}</ApolloProvider>
        </Suspense>
      ),
    }
  );

  await expect(takeSnapshot()).resolves.toEqual({ id: "1" });
  await expect(takeSnapshot).not.toRerender();
});

test("returns undefined when ontoolinput is not fired", async () => {
  using _ = spyOnConsole("debug");
  stubOpenAiGlobals({ toolResponseMetadata: {} });
  const client = new ApolloClient({
    cache: new InMemoryCache(),
    manifest: mockApplicationManifest(),
  });

  using host = await mockMcpHost();
  host.onCleanup(() => client.stop());

  host.sendToolResult({
    content: [],
    structuredContent: {},
  });

  using _disabledAct = disableActEnvironment();
  const { takeSnapshot } = await renderHookToSnapshotStream(
    () => useToolInput(),
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
