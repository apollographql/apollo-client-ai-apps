import { expect, test } from "vitest";
import { useToolName } from "../useToolName.js";
import {
  graphqlToolResult,
  minimalHostContextWithToolName,
  mockApplicationManifest,
  mockMcpHost,
  spyOnConsole,
  stubOpenAiGlobals,
} from "../../../../testing/internal/index.js";
import { ApolloClient } from "../../../core/ApolloClient.js";
import { InMemoryCache } from "@apollo/client";
import {
  disableActEnvironment,
  renderHookToSnapshotStream,
} from "@testing-library/react-render-stream";
import { Suspense } from "react";
import { ApolloProvider } from "../../../../react/ApolloProvider.js";

test("returns the tool name from the MCP host", async () => {
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
