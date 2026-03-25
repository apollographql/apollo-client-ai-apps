import { test, expect } from "vitest";
import {
  disableActEnvironment,
  renderHookToSnapshotStream,
} from "@testing-library/react-render-stream";
import { Suspense } from "react";
import { InMemoryCache } from "@apollo/client";
import { useToolMetadata } from "../useToolMetadata.js";
import {
  eachHostEnv,
  mockApplicationManifest,
  spyOnConsole,
} from "../../../testing/internal/index.js";
import { ApolloProvider } from "../../ApolloProvider.js";

eachHostEnv((setupHost, ApolloClient) => {
  test("returns the tool metadata from the MCP host", async () => {
    using _ = spyOnConsole("debug");
    const client = new ApolloClient({
      cache: new InMemoryCache(),
      manifest: mockApplicationManifest(),
    });

    const { host } = await setupHost({
      client,
      autoTriggerTool: true,
      toolName: "TestTool",
      toolResult: { structuredContent: {}, _meta: { customField: "customValue" } },
    });
    using _host = host;

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

    await expect(takeSnapshot()).resolves.toEqual({
      toolName: "TestTool",
      customField: "customValue",
    });

    await expect(takeSnapshot).not.toRerender();
  });
});
