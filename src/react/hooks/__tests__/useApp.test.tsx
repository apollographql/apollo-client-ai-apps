import { test, expect } from "vitest";
import {
  disableActEnvironment,
  renderHookToSnapshotStream,
} from "@testing-library/react-render-stream";
import { Suspense } from "react";
import { InMemoryCache } from "@apollo/client";
import { App } from "@modelcontextprotocol/ext-apps";

import { useApp } from "../useApp.js";
import {
  eachHostEnv,
  mockApplicationManifest,
  spyOnConsole,
} from "../../../testing/internal/index.js";
import { ApolloProvider } from "../../ApolloProvider.js";

eachHostEnv((setupHost, ApolloClient) => {
  test("returns app instance created by ApolloClient", async () => {
    using _ = spyOnConsole("debug");
    const client = new ApolloClient({
      cache: new InMemoryCache(),
      manifest: mockApplicationManifest(),
    });

    const { host, params } = await setupHost({
      client,
      toolCall: { name: "Test", result: { structuredContent: {} } },
    });
    using _host = host;

    host.sendToolInput(params.toolInput);
    host.sendToolResult(params.toolResult);

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
});
