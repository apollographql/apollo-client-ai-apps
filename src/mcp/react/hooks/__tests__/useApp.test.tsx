import { test, expect } from "vitest";
import {
  disableActEnvironment,
  renderHookToSnapshotStream,
} from "@testing-library/react-render-stream";
import { Suspense } from "react";
import { InMemoryCache } from "@apollo/client";
import { App } from "@modelcontextprotocol/ext-apps";

import { useApp } from "../useApp.js";
import { ApolloClient } from "../../../core/ApolloClient.js";
import {
  mockApplicationManifest,
  mockMcpHost,
  spyOnConsole,
} from "../../../../testing/internal/index.js";
import { ApolloProvider } from "../../../../react/ApolloProvider.js";

test("returns app instance created by ApolloClient", async () => {
  using _ = spyOnConsole("debug");
  const client = new ApolloClient({
    cache: new InMemoryCache(),
    manifest: mockApplicationManifest(),
  });

  using host = await mockMcpHost();
  host.onCleanup(() => client.stop());

  host.sendToolInput({ arguments: {} });
  host.sendToolResult({
    _meta: { toolName: "Test" },
    content: [],
    structuredContent: {},
  });

  using _disabledAct = disableActEnvironment();
  const { takeSnapshot } = await renderHookToSnapshotStream(() => useApp(), {
    wrapper: ({ children }) => (
      <Suspense>
        <ApolloProvider client={client}>{children}</ApolloProvider>
      </Suspense>
    ),
  });

  await expect(takeSnapshot()).resolves.toBeInstanceOf(App);
});
