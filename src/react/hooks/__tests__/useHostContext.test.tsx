import { expect, test } from "vitest";
import { InMemoryCache } from "@apollo/client";
import {
  eachHostEnv,
  minimalHostContextWithToolName,
  mockApplicationManifest,
  spyOnConsole,
} from "../../../testing/internal/index.js";
import {
  disableActEnvironment,
  renderHookToSnapshotStream,
} from "@testing-library/react-render-stream";
import { useHostContext } from "../useHostContext.js";
import { ApolloProvider } from "../../ApolloProvider.js";

eachHostEnv((setupHost, ApolloClient) => {
  test("returns the host context from the host", async () => {
    using _ = spyOnConsole("debug");
    const client = new ApolloClient({
      cache: new InMemoryCache(),
      manifest: mockApplicationManifest(),
    });

    const { host } = await setupHost({
      client,
      autoTriggerTool: true,
      hostContext: {
        ...minimalHostContextWithToolName("GetProduct"),
        theme: "light",
      },
      structuredContent: { result: { data: { product: null } } },
    });
    using _host = host;

    using _disabledAct = disableActEnvironment();
    const { takeSnapshot } = await renderHookToSnapshotStream(
      () => useHostContext(),
      {
        wrapper: ({ children }) => (
          <ApolloProvider client={client}>{children}</ApolloProvider>
        ),
      }
    );

    await expect(takeSnapshot()).resolves.toStrictEqual({
      ...minimalHostContextWithToolName("GetProduct"),
      theme: "light",
    });

    await expect(takeSnapshot).not.toRerender();
  });

  test("rerenders when the host context changes", async () => {
    using _ = spyOnConsole("debug");
    const client = new ApolloClient({
      cache: new InMemoryCache(),
      manifest: mockApplicationManifest(),
    });

    const { host } = await setupHost({
      client,
      autoTriggerTool: true,
      hostContext: {
        ...minimalHostContextWithToolName("GetProduct"),
        theme: "light",
      },
      structuredContent: { result: { data: { product: null } } },
    });
    using _host = host;

    using _disabledAct = disableActEnvironment();
    const { takeSnapshot } = await renderHookToSnapshotStream(
      () => useHostContext(),
      {
        wrapper: ({ children }) => (
          <ApolloProvider client={client}>{children}</ApolloProvider>
        ),
      }
    );

    await expect(takeSnapshot()).resolves.toStrictEqual({
      ...minimalHostContextWithToolName("GetProduct"),
      theme: "light",
    });

    host.sendHostContextChanged({ theme: "dark" });

    await expect(takeSnapshot()).resolves.toStrictEqual({
      ...minimalHostContextWithToolName("GetProduct"),
      theme: "dark",
    });

    await expect(takeSnapshot).not.toRerender();
  });
});
