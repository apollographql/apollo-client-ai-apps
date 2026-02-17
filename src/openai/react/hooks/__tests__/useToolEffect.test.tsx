import { expect, test, vi } from "vitest";
import { useToolEffect } from "../useToolEffect.js";
import { ToolUseProvider } from "../../../../react/ToolUseContext.js";
import {
  graphqlToolResult,
  minimalHostContextWithToolName,
  mockApplicationManifest,
  mockMcpHost,
  spyOnConsole,
  stubOpenAiGlobals,
} from "../../../../testing/internal/index.js";
import { InMemoryCache } from "@apollo/client";
import { ApolloClient } from "../../../core/ApolloClient.js";
import {
  disableActEnvironment,
  renderHookToSnapshotStream,
  createRenderStream,
} from "@testing-library/react-render-stream";
import { Suspense } from "react";
import { ApolloProvider } from "../../../../react/ApolloProvider.js";
import { ErrorBoundary } from "react-error-boundary";

test("triggers effect when tool name matches triggered tool name", async () => {
  stubOpenAiGlobals();
  using _ = spyOnConsole("debug");
  const client = new ApolloClient({
    cache: new InMemoryCache(),
    manifest: mockApplicationManifest(),
  });

  using host = await mockMcpHost({
    hostContext: minimalHostContextWithToolName("my-tool"),
  });
  host.onCleanup(() => client.stop());

  host.sendToolInput({ arguments: {} });
  host.sendToolResult(graphqlToolResult({ data: { product: null } }));

  const navigate = vi.fn();

  using _disabledAct = disableActEnvironment();
  const { takeSnapshot } = await renderHookToSnapshotStream(
    () => useToolEffect("my-tool", () => navigate(), [navigate]),
    {
      wrapper: ({ children }) => (
        <Suspense>
          <ApolloProvider client={client}>
            <ToolUseProvider>{children}</ToolUseProvider>
          </ApolloProvider>
        </Suspense>
      ),
    }
  );

  await expect(takeSnapshot).toRerender();

  expect(navigate).toBeCalled();
});

test("triggers effect when one of multiple tool name matches triggered tool name", async () => {
  stubOpenAiGlobals();
  using _ = spyOnConsole("debug");
  const client = new ApolloClient({
    cache: new InMemoryCache(),
    manifest: mockApplicationManifest(),
  });

  using host = await mockMcpHost({
    hostContext: minimalHostContextWithToolName("my-tool"),
  });
  host.onCleanup(() => client.stop());

  host.sendToolInput({ arguments: {} });
  host.sendToolResult(graphqlToolResult({ data: { product: null } }));

  const navigate = vi.fn();

  using _disabledAct = disableActEnvironment();
  const { takeSnapshot } = await renderHookToSnapshotStream(
    () =>
      useToolEffect(["my-tool", "my-similar-tool"], () => navigate(), [
        navigate,
      ]),
    {
      wrapper: ({ children }) => (
        <Suspense>
          <ApolloProvider client={client}>
            <ToolUseProvider>{children}</ToolUseProvider>
          </ApolloProvider>
        </Suspense>
      ),
    }
  );

  await expect(takeSnapshot).toRerender();

  expect(navigate).toBeCalled();
});

test("does not trigger effect when tool name does not match triggered tool name", async () => {
  stubOpenAiGlobals();
  using _ = spyOnConsole("debug");
  const client = new ApolloClient({
    cache: new InMemoryCache(),
    manifest: mockApplicationManifest(),
  });

  using host = await mockMcpHost({
    hostContext: minimalHostContextWithToolName("my-other-tool"),
  });
  host.onCleanup(() => client.stop());

  host.sendToolInput({ arguments: {} });
  host.sendToolResult(graphqlToolResult({ data: { product: null } }));

  vi.stubGlobal("openai", {
    toolResponseMetadata: { toolName: "my-other-tool" },
  });
  const navigate = vi.fn();

  using _disabledAct = disableActEnvironment();
  const { takeSnapshot } = await renderHookToSnapshotStream(
    () => useToolEffect("my-tool", () => navigate(), [navigate]),
    {
      wrapper: ({ children }) => (
        <Suspense>
          <ApolloProvider client={client}>
            <ToolUseProvider>{children}</ToolUseProvider>
          </ApolloProvider>
        </Suspense>
      ),
    }
  );

  await expect(takeSnapshot).toRerender();
  expect(navigate).not.toBeCalled();
});

test("throws an error when used outside of a ToolUseProvider", async () => {
  stubOpenAiGlobals();
  using _ = spyOnConsole("debug", "error");
  const client = new ApolloClient({
    cache: new InMemoryCache(),
    manifest: mockApplicationManifest(),
  });
  const navigate = vi.fn();

  using host = await mockMcpHost({
    hostContext: minimalHostContextWithToolName("my-other-tool"),
  });
  host.onCleanup(() => client.stop());

  host.sendToolInput({ arguments: {} });
  host.sendToolResult(graphqlToolResult({ data: { product: null } }));

  const renderStream = createRenderStream({ snapshotDOM: true });

  function App() {
    useToolEffect("my-tool", () => navigate(), []);

    return null;
  }

  using _disabledAct = disableActEnvironment();
  await renderStream.render(
    <ErrorBoundary
      fallbackRender={({ error }) => (
        <div data-testid="error">{(error as Error).message}</div>
      )}
    >
      <App />
    </ErrorBoundary>,
    {
      wrapper: ({ children }) => (
        <Suspense>
          <ApolloProvider client={client}>{children}</ApolloProvider>
        </Suspense>
      ),
    }
  );

  // initial suspended render
  await expect(renderStream).toRerender();

  {
    const { withinDOM } = await renderStream.takeRender();

    expect(withinDOM().getByTestId("error").textContent).toBe(
      "useToolEffect must be used within ToolUseProvider"
    );
  }
});
