import { afterEach, test, expect, vi } from "vitest";
import {
  disableActEnvironment,
  renderHookToSnapshotStream,
} from "@testing-library/react-render-stream";
import { Suspense } from "react";
import { InMemoryCache, gql } from "@apollo/client";
import { useToolInputVariables } from "../useToolInputVariables.js";
import { ApolloClient } from "../../../core/ApolloClient.js";
import {
  graphqlToolResult,
  minimalHostContextWithToolName,
  mockApplicationManifest,
  mockMcpHost,
  spyOnConsole,
  stubOpenAiGlobals,
} from "../../../../testing/internal/index.js";
import { ApolloProvider } from "../../../../react/ApolloProvider.js";

afterEach(() => {
  vi.unstubAllGlobals();
});

const PRODUCT_QUERY = gql`
  query Product($id: ID!) @tool(name: "GetProduct") {
    product(id: $id) {
      id
      title
    }
  }
`;

const PRODUCT_WITH_PAGE_QUERY = gql`
  query Product($id: ID!, $page: Int) @tool(name: "GetProduct") {
    product(id: $id) {
      id
      title
    }
  }
`;

test("returns defaultVariables when tool input is undefined", async () => {
  using _ = spyOnConsole("debug");
  stubOpenAiGlobals({ toolResponseMetadata: {} });
  const client = new ApolloClient({
    cache: new InMemoryCache(),
    manifest: mockApplicationManifest(),
  });

  using host = await mockMcpHost();
  host.onCleanup(() => client.stop());

  host.sendToolResult({ content: [], structuredContent: {} });

  using _disabledAct = disableActEnvironment();
  const { takeSnapshot } = await renderHookToSnapshotStream(
    () => useToolInputVariables(PRODUCT_QUERY, { id: "default" }),
    {
      wrapper: ({ children }) => (
        <Suspense>
          <ApolloProvider client={client}>{children}</ApolloProvider>
        </Suspense>
      ),
    }
  );

  const [variables] = await takeSnapshot();
  expect(variables).toEqual({ id: "default" });

  await expect(takeSnapshot).not.toRerender();
});

test("returns tool input variables when tool name matches @tool directive", async () => {
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
    () => useToolInputVariables(PRODUCT_QUERY, { id: "default" }),
    {
      wrapper: ({ children }) => (
        <Suspense>
          <ApolloProvider client={client}>{children}</ApolloProvider>
        </Suspense>
      ),
    }
  );

  const [variables] = await takeSnapshot();
  expect(variables).toEqual({ id: "1" });

  await expect(takeSnapshot).not.toRerender();
});

test("returns defaultVariables when tool name does not match @tool directive", async () => {
  using _ = spyOnConsole("debug");
  stubOpenAiGlobals({ toolResponseMetadata: {}, toolInput: { id: "1" } });
  const client = new ApolloClient({
    cache: new InMemoryCache(),
    manifest: mockApplicationManifest({
      operations: [
        {
          ...mockApplicationManifest().operations[0],
          tools: [{ name: "OtherTool", description: "A different tool" }],
        },
      ],
    }),
  });

  using host = await mockMcpHost({
    hostContext: minimalHostContextWithToolName("OtherTool"),
  });
  host.onCleanup(() => client.stop());

  host.sendToolInput({ arguments: { id: "1" } });
  host.sendToolResult(graphqlToolResult({ data: { product: null } }));

  using _disabledAct = disableActEnvironment();
  const { takeSnapshot } = await renderHookToSnapshotStream(
    () => useToolInputVariables(PRODUCT_QUERY, { id: "default" }),
    {
      wrapper: ({ children }) => (
        <Suspense>
          <ApolloProvider client={client}>{children}</ApolloProvider>
        </Suspense>
      ),
    }
  );

  const [variables] = await takeSnapshot();
  expect(variables).toEqual({ id: "default" });

  await expect(takeSnapshot).not.toRerender();
});

test("filters extra tool input keys not in the operation's variableDefinitions", async () => {
  using _ = spyOnConsole("debug");
  stubOpenAiGlobals({
    toolResponseMetadata: {},
    toolInput: { id: "1", extraParam: "should-be-ignored" },
  });
  const client = new ApolloClient({
    cache: new InMemoryCache(),
    manifest: mockApplicationManifest(),
  });

  using host = await mockMcpHost({
    hostContext: minimalHostContextWithToolName("GetProduct"),
  });
  host.onCleanup(() => client.stop());

  host.sendToolInput({
    arguments: { id: "1", extraParam: "should-be-ignored" },
  });
  host.sendToolResult(graphqlToolResult({ data: { product: null } }));

  using _disabledAct = disableActEnvironment();
  const { takeSnapshot } = await renderHookToSnapshotStream(
    () => useToolInputVariables(PRODUCT_QUERY, { id: "default" }),
    {
      wrapper: ({ children }) => (
        <Suspense>
          <ApolloProvider client={client}>{children}</ApolloProvider>
        </Suspense>
      ),
    }
  );

  const [variables] = await takeSnapshot();
  expect(variables).toEqual({ id: "1" });

  await expect(takeSnapshot).not.toRerender();
});

test("setVariables shallow-merges a partial object update", async () => {
  using _ = spyOnConsole("debug");
  stubOpenAiGlobals({
    toolResponseMetadata: {},
    toolInput: { id: "1", page: 1 },
  });
  const client = new ApolloClient({
    cache: new InMemoryCache(),
    manifest: mockApplicationManifest(),
  });

  using host = await mockMcpHost({
    hostContext: minimalHostContextWithToolName("GetProduct"),
  });
  host.onCleanup(() => client.stop());

  host.sendToolInput({ arguments: { id: "1", page: 1 } });
  host.sendToolResult(graphqlToolResult({ data: { product: null } }));

  using _disabledAct = disableActEnvironment();
  const { takeSnapshot } = await renderHookToSnapshotStream(
    () =>
      useToolInputVariables(PRODUCT_WITH_PAGE_QUERY, {
        id: "default",
        page: 1,
      }),
    {
      wrapper: ({ children }) => (
        <Suspense>
          <ApolloProvider client={client}>{children}</ApolloProvider>
        </Suspense>
      ),
    }
  );

  const [initialVariables, setVariables] = await takeSnapshot();
  expect(initialVariables).toEqual({ id: "1", page: 1 });

  setVariables({ page: 2 });

  const [updatedVariables] = await takeSnapshot();
  expect(updatedVariables).toEqual({ id: "1", page: 2 });

  await expect(takeSnapshot).not.toRerender();
});

test("setVariables updater function receives current variables to compute updates", async () => {
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
    () => useToolInputVariables(PRODUCT_QUERY, { id: "default" }),
    {
      wrapper: ({ children }) => (
        <Suspense>
          <ApolloProvider client={client}>{children}</ApolloProvider>
        </Suspense>
      ),
    }
  );

  const [initialVariables, setVariables] = await takeSnapshot();
  expect(initialVariables).toEqual({ id: "1" });

  setVariables((prev) => ({ id: `${prev.id}-updated` }));

  const [updatedVariables] = await takeSnapshot();
  expect(updatedVariables).toEqual({ id: "1-updated" });

  await expect(takeSnapshot).not.toRerender();
});

test("setVariables updater function shallow-merges partial result", async () => {
  using _ = spyOnConsole("debug");
  stubOpenAiGlobals({
    toolResponseMetadata: {},
    toolInput: { id: "1", page: 1 },
  });
  const client = new ApolloClient({
    cache: new InMemoryCache(),
    manifest: mockApplicationManifest(),
  });

  using host = await mockMcpHost({
    hostContext: minimalHostContextWithToolName("GetProduct"),
  });
  host.onCleanup(() => client.stop());

  host.sendToolInput({ arguments: { id: "1", page: 1 } });
  host.sendToolResult(graphqlToolResult({ data: { product: null } }));

  using _disabledAct = disableActEnvironment();
  const { takeSnapshot } = await renderHookToSnapshotStream(
    () =>
      useToolInputVariables(PRODUCT_WITH_PAGE_QUERY, {
        id: "default",
        page: 1,
      }),
    {
      wrapper: ({ children }) => (
        <Suspense>
          <ApolloProvider client={client}>{children}</ApolloProvider>
        </Suspense>
      ),
    }
  );

  const [initialVariables, setVariables] = await takeSnapshot();
  expect(initialVariables).toEqual({ id: "1", page: 1 });

  setVariables((prev) => ({ page: prev.page + 1 }));

  const [updatedVariables] = await takeSnapshot();
  expect(updatedVariables).toEqual({ id: "1", page: 2 });

  await expect(takeSnapshot).not.toRerender();
});
