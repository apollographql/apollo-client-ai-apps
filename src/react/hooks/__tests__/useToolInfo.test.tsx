import { test, expect } from "vitest";
import {
  disableActEnvironment,
  renderHookToSnapshotStream,
} from "@testing-library/react-render-stream";
import { Suspense } from "react";
import { InMemoryCache } from "@apollo/client";

import { useToolInfo } from "../useToolInfo.js";
import {
  eachHostEnv,
  mockApplicationManifest,
  spyOnConsole,
} from "../../../testing/internal/index.js";
import { ApolloProvider } from "../../ApolloProvider.js";

eachHostEnv((setupHost, ApolloClient, { hostEnv }) => {
  test("returns tool name and input combined", async () => {
    using _ = spyOnConsole("debug");
    const client = new ApolloClient({
      cache: new InMemoryCache(),
      manifest: mockApplicationManifest(),
    });

    using env = await setupHost({
      client,
      toolCall: {
        name: "GetProduct",
        input: { id: "1" },
        result: { structuredContent: { result: { data: { product: null } } } },
      },
    });
    const { host, params } = env;

    host.sendToolInput(params.toolInput);
    host.sendToolResult(params.toolResult);

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

  if (hostEnv === "openai") {
    test("returns undefined toolInput when toolInput is not provided", async () => {
      using _ = spyOnConsole("debug");
      const client = new ApolloClient({
        cache: new InMemoryCache(),
        manifest: mockApplicationManifest(),
      });

      using env = await setupHost({
        client,
        toolCall: { name: "GetProduct" },
      });
      const { host } = env;

      host.sendToolResult({
        structuredContent: { result: { data: { product: null } } },
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

      await expect(takeSnapshot()).resolves.toEqual({
        toolName: "GetProduct",
        toolInput: undefined,
      });
      await expect(takeSnapshot).not.toRerender();
    });
  }
});
