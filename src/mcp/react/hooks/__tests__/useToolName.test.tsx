import { test, expect } from "vitest";
import {
  disableActEnvironment,
  renderHookToSnapshotStream,
} from "@testing-library/react-render-stream";
import { Suspense } from "react";
import { InMemoryCache } from "@apollo/client";

import { useToolName } from "../useToolName.js";
import { ApolloClient } from "../../../core/ApolloClient.js";
import {
  mockApplicationManifest,
  mockMcpHost,
  spyOnConsole,
} from "../../../../testing/internal/index.js";
import { ApolloProvider } from "../../../../react/ApolloProvider.js";

test("returns the tool name from the MCP host", async () => {
  using _ = spyOnConsole("debug");
  const client = new ApolloClient({
    cache: new InMemoryCache(),
    manifest: mockApplicationManifest(),
  });

  using host = await mockMcpHost({
    hostContext: {
      toolInfo: {
        tool: { name: "GetProduct", inputSchema: { type: "object" } },
      },
    },
  });
  host.onCleanup(() => client.stop());

  host.sendToolInput({ arguments: {} });
  host.sendToolResult({
    content: [],
    structuredContent: {},
  });

  using _disabledAct = disableActEnvironment();
  const { takeSnapshot } = await renderHookToSnapshotStream(
    () => useToolName(),
    {
      wrapper: ({ children }) => (
        <Suspense>
          <ApolloProvider client={client}>{children}</ApolloProvider>
        </Suspense>
      ),
    }
  );

  await expect(takeSnapshot()).resolves.toBe("GetProduct");

  await expect(takeSnapshot).not.toRerender();
});
