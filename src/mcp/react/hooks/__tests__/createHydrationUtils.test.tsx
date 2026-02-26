import { describe, test, expect } from "vitest";
import {
  createRenderStream,
  disableActEnvironment,
  renderHookToSnapshotStream,
} from "@testing-library/react-render-stream";
import { InMemoryCache, gql, type TypedDocumentNode } from "@apollo/client";
import { createHydrationUtils } from "../createHydrationUtils.js";
import { reactive } from "../../../../react/reactive.js";
import { ApolloClient } from "../../../core/ApolloClient.js";
import {
  graphqlToolResult,
  minimalHostContextWithToolName,
  mockApplicationManifest,
  mockMcpHost,
  spyOnConsole,
} from "../../../../testing/internal/index.js";
import { ApolloProvider } from "../../../../react/ApolloProvider.js";
import { StrictMode } from "react";
import assert from "node:assert";

const PRODUCTS_QUERY: TypedDocumentNode<
  { products: Array<{ __typename: "Product"; id: string }> },
  { category: string; page: number; sortBy: string }
> = gql`
  query Products($category: String!, $page: Int!, $sortBy: String!)
  @tool(name: "GetProductsByCategory") {
    products(category: $category, page: $page, sortBy: $sortBy) {
      id
    }
  }
`;

test("returns tool input value when tool matches", async () => {
  using _ = spyOnConsole("debug");
  const client = new ApolloClient({
    cache: new InMemoryCache(),
    manifest: mockApplicationManifest(),
  });

  using host = await mockMcpHost({
    hostContext: minimalHostContextWithToolName("GetProductsByCategory"),
  });
  host.onCleanup(() => client.stop());

  host.sendToolInput({
    arguments: { category: "electronics", page: 1, sortBy: "title" },
  });
  host.sendToolResult(graphqlToolResult({ data: { products: [] } }));

  const { useHydratedVariables } = createHydrationUtils(PRODUCTS_QUERY);

  using _disabledAct = disableActEnvironment();
  const { takeSnapshot } = await renderHookToSnapshotStream(
    () =>
      useHydratedVariables({
        category: "music",
        page: 1,
        sortBy: "name",
      }),
    {
      wrapper: ({ children }) => (
        <ApolloProvider client={client}>{children}</ApolloProvider>
      ),
    }
  );

  const [variables] = await takeSnapshot();
  expect(variables).toStrictEqual({
    category: "electronics",
    page: 1,
    sortBy: "title",
  });

  await expect(takeSnapshot).not.toRerender();
});

test("returns user-provided variables when tool name does not match", async () => {
  using _ = spyOnConsole("debug");
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

  host.sendToolInput({
    arguments: { category: "electronics", page: 1, sortBy: "title" },
  });
  host.sendToolResult(graphqlToolResult({ data: { product: null } }));

  const { useHydratedVariables } = createHydrationUtils(PRODUCTS_QUERY);

  using _disabledAct = disableActEnvironment();
  const { takeSnapshot } = await renderHookToSnapshotStream(
    () =>
      useHydratedVariables({
        category: "music",
        page: 1,
        sortBy: "name",
      }),
    {
      wrapper: ({ children }) => (
        <ApolloProvider client={client}>{children}</ApolloProvider>
      ),
    }
  );

  const [variables] = await takeSnapshot();
  expect(variables).toStrictEqual({
    category: "music",
    page: 1,
    sortBy: "name",
  });

  await expect(takeSnapshot).not.toRerender();
});

test("filters tool input not in document's variable definitions when tool matches", async () => {
  using _ = spyOnConsole("debug");

  const query: TypedDocumentNode<unknown, { id: string }> = gql`
    query GetProduct($id: ID!) @tool(name: "GetProduct") {
      product(id: $id) {
        id
      }
    }
  `;
  const { useHydratedVariables } = createHydrationUtils(query);

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
    () => useHydratedVariables({ id: "default" }),
    {
      wrapper: ({ children }) => (
        <ApolloProvider client={client}>{children}</ApolloProvider>
      ),
    }
  );

  const [variables] = await takeSnapshot();
  expect(variables).toStrictEqual({ id: "1" });

  await expect(takeSnapshot).not.toRerender();
});

test("does not add user-provided variables not in document's variable definitions when tool matches", async () => {
  using _ = spyOnConsole("debug");

  const query: TypedDocumentNode<unknown, { id: string }> = gql`
    query GetProduct($id: ID!) @tool(name: "GetProduct") {
      product(id: $id) {
        id
      }
    }
  `;
  const { useHydratedVariables } = createHydrationUtils(query);

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
    () => useHydratedVariables({ id: "default", notInDoc: true } as any),
    {
      wrapper: ({ children }) => (
        <ApolloProvider client={client}>{children}</ApolloProvider>
      ),
    }
  );

  const [variables] = await takeSnapshot();
  expect(variables).toStrictEqual({ id: "1" });

  await expect(takeSnapshot).not.toRerender();
});

test("filters user-provided variables not in document's variable definitions when tool does not match", async () => {
  using _ = spyOnConsole("debug");

  const query: TypedDocumentNode<unknown, { id: string }> = gql`
    query GetProduct($id: ID!) @tool(name: "GetProduct") {
      product(id: $id) {
        id
      }
    }
  `;
  const { useHydratedVariables } = createHydrationUtils(query);

  const client = new ApolloClient({
    cache: new InMemoryCache(),
    manifest: mockApplicationManifest(),
  });

  using host = await mockMcpHost({
    hostContext: minimalHostContextWithToolName("OtherTool"),
  });
  host.onCleanup(() => client.stop());

  host.sendToolInput({ arguments: { id: "1" } });
  host.sendToolResult(graphqlToolResult({ data: { product: null } }));

  using _disabledAct = disableActEnvironment();
  const { takeSnapshot } = await renderHookToSnapshotStream(
    () => useHydratedVariables({ id: "default", notInDoc: true } as any),
    {
      wrapper: ({ children }) => (
        <ApolloProvider client={client}>{children}</ApolloProvider>
      ),
    }
  );

  const [variables] = await takeSnapshot();
  expect(variables).toStrictEqual({ id: "default" });

  await expect(takeSnapshot).not.toRerender();
});

test("setVariables shallow-merges a partial update", async () => {
  using _ = spyOnConsole("debug");
  const client = new ApolloClient({
    cache: new InMemoryCache(),
    manifest: mockApplicationManifest(),
  });

  using host = await mockMcpHost({
    hostContext: minimalHostContextWithToolName("GetProductsByCategory"),
  });
  host.onCleanup(() => client.stop());

  host.sendToolInput({
    arguments: { category: "electronics", page: 1, sortBy: "title" },
  });
  host.sendToolResult(graphqlToolResult({ data: { products: [] } }));

  const { useHydratedVariables } = createHydrationUtils(PRODUCTS_QUERY);

  using _disabledAct = disableActEnvironment();
  const { takeSnapshot } = await renderHookToSnapshotStream(
    () =>
      useHydratedVariables({
        category: "music",
        page: 1,
        sortBy: "name",
      }),
    {
      wrapper: ({ children }) => (
        <ApolloProvider client={client}>{children}</ApolloProvider>
      ),
    }
  );

  const [initialVariables, setVariables] = await takeSnapshot();
  expect(initialVariables).toStrictEqual({
    category: "electronics",
    page: 1,
    sortBy: "title",
  });

  setVariables({ page: 2 });

  const [updatedVariables] = await takeSnapshot();
  expect(updatedVariables).toStrictEqual({
    category: "electronics",
    page: 2,
    sortBy: "title",
  });

  await expect(takeSnapshot).not.toRerender();
});

test("setVariables supports updater function", async () => {
  using _ = spyOnConsole("debug");
  const client = new ApolloClient({
    cache: new InMemoryCache(),
    manifest: mockApplicationManifest(),
  });

  using host = await mockMcpHost({
    hostContext: minimalHostContextWithToolName("GetProductsByCategory"),
  });
  host.onCleanup(() => client.stop());

  host.sendToolInput({
    arguments: { category: "electronics", page: 1, sortBy: "title" },
  });
  host.sendToolResult(graphqlToolResult({ data: { products: [] } }));

  const { useHydratedVariables } = createHydrationUtils(PRODUCTS_QUERY);

  using _disabledAct = disableActEnvironment();
  const { takeSnapshot } = await renderHookToSnapshotStream(
    () =>
      useHydratedVariables({
        category: "music",
        page: 1,
        sortBy: "name",
      }),
    {
      wrapper: ({ children }) => (
        <ApolloProvider client={client}>{children}</ApolloProvider>
      ),
    }
  );

  const [initialVariables, setVariables] = await takeSnapshot();
  expect(initialVariables).toStrictEqual({
    category: "electronics",
    page: 1,
    sortBy: "title",
  });

  setVariables((prev) => ({ page: prev.page + 1 }));

  const [updatedVariables] = await takeSnapshot();
  expect(updatedVariables).toStrictEqual({
    category: "electronics",
    page: 2,
    sortBy: "title",
  });

  await expect(takeSnapshot).not.toRerender();
});

test("setVariables ignores reactive variable keys (object form)", async () => {
  using _ = spyOnConsole("debug", "warn");
  const client = new ApolloClient({
    cache: new InMemoryCache(),
    manifest: mockApplicationManifest(),
  });

  using host = await mockMcpHost({
    hostContext: minimalHostContextWithToolName("GetProductsByCategory"),
  });
  host.onCleanup(() => client.stop());

  host.sendToolInput({
    arguments: { category: "electronics", page: 1, sortBy: "title" },
  });
  host.sendToolResult(graphqlToolResult({ data: { products: [] } }));

  const { useHydratedVariables } = createHydrationUtils(PRODUCTS_QUERY);

  using _disabledAct = disableActEnvironment();
  const { takeSnapshot } = await renderHookToSnapshotStream(
    () =>
      useHydratedVariables({
        category: reactive("music"),
        page: 1,
        sortBy: "name",
      }),
    {
      wrapper: ({ children }) => (
        <ApolloProvider client={client}>{children}</ApolloProvider>
      ),
    }
  );

  const [initialVariables, setVariables] = await takeSnapshot();
  expect(initialVariables).toStrictEqual({
    category: "electronics",
    page: 1,
    sortBy: "title",
  });

  // @ts-expect-error category is reactive
  setVariables({ category: "sports" });

  expect(console.warn).toHaveBeenCalledWith(
    expect.stringContaining('Attempted to set reactive variable "category"')
  );
  await expect(takeSnapshot).not.toRerender();
});

test("setVariables ignores reactive variable keys (callback form)", async () => {
  using _ = spyOnConsole("debug", "warn");
  const client = new ApolloClient({
    cache: new InMemoryCache(),
    manifest: mockApplicationManifest(),
  });

  using host = await mockMcpHost({
    hostContext: minimalHostContextWithToolName("GetProductsByCategory"),
  });
  host.onCleanup(() => client.stop());

  host.sendToolInput({
    arguments: { category: "electronics", page: 1, sortBy: "title" },
  });
  host.sendToolResult(graphqlToolResult({ data: { products: [] } }));

  const { useHydratedVariables } = createHydrationUtils(PRODUCTS_QUERY);

  using _disabledAct = disableActEnvironment();
  const { takeSnapshot } = await renderHookToSnapshotStream(
    () =>
      useHydratedVariables({
        category: reactive("music"),
        page: 1,
        sortBy: "name",
      }),
    {
      wrapper: ({ children }) => (
        <ApolloProvider client={client}>{children}</ApolloProvider>
      ),
    }
  );

  const [initialVariables, setVariables] = await takeSnapshot();
  expect(initialVariables).toStrictEqual({
    category: "electronics",
    page: 1,
    sortBy: "title",
  });

  // @ts-expect-error category is reactive
  setVariables(() => ({ category: "sports" }));

  expect(console.warn).toHaveBeenCalledWith(
    expect.stringContaining('Attempted to set reactive variable "category"')
  );
  await expect(takeSnapshot).not.toRerender();
});

test("state variable is not reset when component re-renders with new input", async () => {
  using _ = spyOnConsole("debug");
  const client = new ApolloClient({
    cache: new InMemoryCache(),
    manifest: mockApplicationManifest(),
  });

  using host = await mockMcpHost({
    hostContext: minimalHostContextWithToolName("GetProductsByCategory"),
  });
  host.onCleanup(() => client.stop());

  host.sendToolInput({
    arguments: { category: "electronics", page: 1, sortBy: "title" },
  });
  host.sendToolResult(graphqlToolResult({ data: { products: [] } }));

  const { useHydratedVariables } = createHydrationUtils(PRODUCTS_QUERY);

  using _disabledAct = disableActEnvironment();
  const { takeSnapshot, getCurrentSnapshot, rerender } =
    await renderHookToSnapshotStream(
      ({ sortBy }) =>
        useHydratedVariables({
          category: "music",
          page: 1,
          sortBy,
        }),
      {
        initialProps: { sortBy: "name" },
        wrapper: ({ children }) => (
          <ApolloProvider client={client}>{children}</ApolloProvider>
        ),
      }
    );

  {
    const [variables] = await takeSnapshot();

    expect(variables).toStrictEqual({
      category: "electronics",
      page: 1,
      sortBy: "title",
    });
  }

  const [, setVariables] = getCurrentSnapshot();
  setVariables({ sortBy: "price" });

  {
    const [variables] = await takeSnapshot();

    expect(variables).toStrictEqual({
      category: "electronics",
      page: 1,
      sortBy: "price",
    });
  }

  rerender({ sortBy: "ignored" });

  {
    const [variables] = await takeSnapshot();

    expect(variables).toStrictEqual({
      category: "electronics",
      page: 1,
      sortBy: "price",
    });
  }

  await expect(takeSnapshot).not.toRerender();
});

test("returns tool input value for reactive variable when tool matches", async () => {
  using _ = spyOnConsole("debug");
  const client = new ApolloClient({
    cache: new InMemoryCache(),
    manifest: mockApplicationManifest(),
  });

  using host = await mockMcpHost({
    hostContext: minimalHostContextWithToolName("GetProductsByCategory"),
  });
  host.onCleanup(() => client.stop());

  host.sendToolInput({
    arguments: { category: "electronics", page: 1, sortBy: "title" },
  });
  host.sendToolResult(graphqlToolResult({ data: { products: [] } }));

  const { useHydratedVariables } = createHydrationUtils(PRODUCTS_QUERY);

  using _disabledAct = disableActEnvironment();
  const { takeSnapshot } = await renderHookToSnapshotStream(
    () =>
      useHydratedVariables({
        category: reactive("music"),
        page: 1,
        sortBy: "name",
      }),
    {
      wrapper: ({ children }) => (
        <ApolloProvider client={client}>{children}</ApolloProvider>
      ),
    }
  );

  const [variables] = await takeSnapshot();
  expect(variables).toStrictEqual({
    category: "electronics",
    page: 1,
    sortBy: "title",
  });

  await expect(takeSnapshot).not.toRerender();
});

test("reactive variable follows the provided value after it updates", async () => {
  using _ = spyOnConsole("debug");
  const client = new ApolloClient({
    cache: new InMemoryCache(),
    manifest: mockApplicationManifest(),
  });

  using host = await mockMcpHost({
    hostContext: minimalHostContextWithToolName("GetProductsByCategory"),
  });
  host.onCleanup(() => client.stop());

  host.sendToolInput({
    arguments: { category: "electronics", page: 1, sortBy: "title" },
  });
  host.sendToolResult(graphqlToolResult({ data: { products: [] } }));

  const { useHydratedVariables } = createHydrationUtils(PRODUCTS_QUERY);

  using _disabledAct = disableActEnvironment();

  const { takeSnapshot, rerender } = await renderHookToSnapshotStream(
    ({ category }) =>
      useHydratedVariables({
        category: reactive(category),
        page: 1,
        sortBy: "name",
      }),
    {
      initialProps: { category: "default" },
      wrapper: ({ children }) => (
        <ApolloProvider client={client}>{children}</ApolloProvider>
      ),
    }
  );

  {
    const [variables] = await takeSnapshot();

    expect(variables).toStrictEqual({
      category: "electronics",
      page: 1,
      sortBy: "title",
    });
  }

  rerender({ category: "music" });

  {
    const [variables] = await takeSnapshot();

    expect(variables).toStrictEqual({
      category: "music",
      page: 1,
      sortBy: "title",
    });
  }

  rerender({ category: "sports" });

  {
    const [variables] = await takeSnapshot();

    expect(variables).toStrictEqual({
      category: "sports",
      page: 1,
      sortBy: "title",
    });
  }

  rerender({ category: "default" });

  {
    const [variables] = await takeSnapshot();

    expect(variables).toStrictEqual({
      category: "default",
      page: 1,
      sortBy: "title",
    });
  }

  await expect(takeSnapshot).not.toRerender();
});

test("reactive variable returns provided value when tool name does not match", async () => {
  using _ = spyOnConsole("debug");
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

  host.sendToolInput({
    arguments: { category: "electronics", page: 1, sortBy: "title" },
  });
  host.sendToolResult(graphqlToolResult({ data: { product: null } }));

  const { useHydratedVariables } = createHydrationUtils(PRODUCTS_QUERY);

  using _disabledAct = disableActEnvironment();
  const { takeSnapshot } = await renderHookToSnapshotStream(
    () =>
      useHydratedVariables({
        category: reactive("music"),
        page: 1,
        sortBy: "name",
      }),
    {
      wrapper: ({ children }) => (
        <ApolloProvider client={client}>{children}</ApolloProvider>
      ),
    }
  );

  const [variables] = await takeSnapshot();
  expect(variables).toStrictEqual({
    category: "music",
    page: 1,
    sortBy: "name",
  });

  await expect(takeSnapshot).not.toRerender();
});

test("optional state variable is omitted from result when tool input omits it", async () => {
  using _ = spyOnConsole("debug");

  const query: TypedDocumentNode<
    any,
    { category: string; page?: number | null }
  > = gql`
    query OptionalProduct($category: String!, $page: Int)
    @tool(name: "GetProductsByCategory") {
      products(category: $category, page: $page) {
        id
      }
    }
  `;

  const client = new ApolloClient({
    cache: new InMemoryCache(),
    manifest: mockApplicationManifest(),
  });

  using host = await mockMcpHost({
    hostContext: minimalHostContextWithToolName("GetProductsByCategory"),
  });
  host.onCleanup(() => client.stop());

  host.sendToolInput({ arguments: { category: "electronics" } });
  host.sendToolResult(graphqlToolResult({ data: { products: [] } }));

  const { useHydratedVariables } = createHydrationUtils(query);

  using _disabledAct = disableActEnvironment();
  const { takeSnapshot } = await renderHookToSnapshotStream(
    () => useHydratedVariables({ category: "music", page: 1 }),
    {
      wrapper: ({ children }) => (
        <ApolloProvider client={client}>{children}</ApolloProvider>
      ),
    }
  );

  const [variables] = await takeSnapshot();
  expect(variables).toStrictEqual({ category: "electronics" });

  await expect(takeSnapshot).not.toRerender();
});

test("optional reactive variable is omitted from result when tool input omits it, then appears once reactive prop changes", async () => {
  using _ = spyOnConsole("debug");

  const query: TypedDocumentNode<
    unknown,
    { category: string; page?: number | null }
  > = gql`
    query OptionalProduct($category: String!, $page: Int)
    @tool(name: "GetProductsByCategory") {
      products(category: $category, page: $page) {
        id
      }
    }
  `;

  const client = new ApolloClient({
    cache: new InMemoryCache(),
    manifest: mockApplicationManifest(),
  });

  using host = await mockMcpHost({
    hostContext: minimalHostContextWithToolName("GetProductsByCategory"),
  });
  host.onCleanup(() => client.stop());

  host.sendToolInput({ arguments: { category: "electronics" } });
  host.sendToolResult(graphqlToolResult({ data: { products: [] } }));

  const { useHydratedVariables } = createHydrationUtils(query);

  using _disabledAct = disableActEnvironment();

  const { takeSnapshot, rerender } = await renderHookToSnapshotStream(
    ({ page }) =>
      useHydratedVariables({
        category: "music",
        page: reactive(page),
      }),
    {
      initialProps: { page: 1 },
      wrapper: ({ children }) => (
        <ApolloProvider client={client}>{children}</ApolloProvider>
      ),
    }
  );

  {
    const [variables] = await takeSnapshot();

    expect(variables).toStrictEqual({ category: "electronics" });
  }

  rerender({ page: 2 });

  {
    const [variables] = await takeSnapshot();

    expect(variables).toStrictEqual({ category: "electronics", page: 2 });
  }

  await expect(takeSnapshot).not.toRerender();
});

test("handles optional variables initially omitted from user-variables when tool input matches", async () => {
  using _ = spyOnConsole("debug");

  const query: TypedDocumentNode<
    any,
    { category: string; page?: number | null }
  > = gql`
    query OptionalProduct($category: String!, $page: Int)
    @tool(name: "GetProductsByCategory") {
      products(category: $category, page: $page) {
        id
      }
    }
  `;

  const client = new ApolloClient({
    cache: new InMemoryCache(),
    manifest: mockApplicationManifest(),
  });

  using host = await mockMcpHost({
    hostContext: minimalHostContextWithToolName("GetProductsByCategory"),
  });
  host.onCleanup(() => client.stop());

  host.sendToolInput({ arguments: { category: "electronics", page: 1 } });
  host.sendToolResult(graphqlToolResult({ data: { products: [] } }));

  const { useHydratedVariables } = createHydrationUtils(query);

  using _disabledAct = disableActEnvironment();
  const { takeSnapshot } = await renderHookToSnapshotStream(
    () => useHydratedVariables({ category: "music" }),
    {
      wrapper: ({ children }) => (
        <ApolloProvider client={client}>{children}</ApolloProvider>
      ),
    }
  );

  const [variables, setVariables] = await takeSnapshot();
  expect(variables).toStrictEqual({ category: "electronics", page: 1 });

  setVariables({ page: 2 });

  {
    const [variables] = await takeSnapshot();

    expect(variables).toStrictEqual({
      category: "electronics",
      page: 2,
    });
  }

  await expect(takeSnapshot).not.toRerender();
});

test("handles optional variables initially omitted from user-variables when tool input doesn't match", async () => {
  using _ = spyOnConsole("debug");

  const query: TypedDocumentNode<
    any,
    { category: string; page?: number | null }
  > = gql`
    query OptionalProduct($category: String!, $page: Int)
    @tool(name: "GetProductsByCategory") {
      products(category: $category, page: $page) {
        id
      }
    }
  `;

  const client = new ApolloClient({
    cache: new InMemoryCache(),
    manifest: mockApplicationManifest(),
  });

  using host = await mockMcpHost({
    hostContext: minimalHostContextWithToolName("OtherTool"),
  });
  host.onCleanup(() => client.stop());

  host.sendToolInput({ arguments: { category: "electronics", page: 1 } });
  host.sendToolResult(graphqlToolResult({ data: { products: [] } }));

  const { useHydratedVariables } = createHydrationUtils(query);

  using _disabledAct = disableActEnvironment();
  const { takeSnapshot } = await renderHookToSnapshotStream(
    () => useHydratedVariables({ category: "music" }),
    {
      wrapper: ({ children }) => (
        <ApolloProvider client={client}>{children}</ApolloProvider>
      ),
    }
  );

  const [variables, setVariables] = await takeSnapshot();
  expect(variables).toStrictEqual({ category: "music" });

  setVariables({ page: 2 });

  {
    const [variables] = await takeSnapshot();

    expect(variables).toStrictEqual({
      category: "music",
      page: 2,
    });
  }

  await expect(takeSnapshot).not.toRerender();
});

test("returned variables are referentially stable between re-renders when nothing changes", async () => {
  using _ = spyOnConsole("debug");
  const client = new ApolloClient({
    cache: new InMemoryCache(),
    manifest: mockApplicationManifest(),
  });

  using host = await mockMcpHost({
    hostContext: minimalHostContextWithToolName("GetProductsByCategory"),
  });
  host.onCleanup(() => client.stop());

  host.sendToolInput({
    arguments: { category: "electronics", page: 1, sortBy: "title" },
  });
  host.sendToolResult(graphqlToolResult({ data: { products: [] } }));

  const { useHydratedVariables } = createHydrationUtils(PRODUCTS_QUERY);

  using _disabledAct = disableActEnvironment();
  const { takeSnapshot, rerender } = await renderHookToSnapshotStream(
    () =>
      useHydratedVariables({
        category: "music",
        page: 1,
        sortBy: "name",
      }),
    {
      wrapper: ({ children }) => (
        <ApolloProvider client={client}>{children}</ApolloProvider>
      ),
    }
  );

  const [initialVariables] = await takeSnapshot();
  expect(initialVariables).toStrictEqual({
    category: "electronics",
    page: 1,
    sortBy: "title",
  });

  rerender();

  {
    const [variables] = await takeSnapshot();

    expect(variables).toBe(initialVariables);
  }

  rerender();

  {
    const [variables] = await takeSnapshot();

    expect(variables).toBe(initialVariables);
  }

  await expect(takeSnapshot).not.toRerender();
});

test("state variable is hydrated when tool name matches one of multiple @tool directives", async () => {
  using _ = spyOnConsole("debug");

  const MULTI_TOOL_QUERY: TypedDocumentNode<
    unknown,
    { category: string; page: number; sortBy: string }
  > = gql`
    query Products($category: String!, $page: Int!, $sortBy: String!)
    @tool(name: "GetProducts")
    @tool(name: "GetProductsAlt") {
      products(category: $category, page: $page, sortBy: $sortBy) {
        id
      }
    }
  `;

  const client = new ApolloClient({
    cache: new InMemoryCache(),
    manifest: mockApplicationManifest(),
  });

  using host = await mockMcpHost({
    hostContext: minimalHostContextWithToolName("GetProductsAlt"),
  });
  host.onCleanup(() => client.stop());

  host.sendToolInput({
    arguments: {
      category: "electronics",
      page: 2,
      sortBy: "price",
    },
  });
  host.sendToolResult(graphqlToolResult({ data: { products: [] } }));

  const { useHydratedVariables } = createHydrationUtils(MULTI_TOOL_QUERY);

  using _disabledAct = disableActEnvironment();
  const { takeSnapshot } = await renderHookToSnapshotStream(
    () =>
      useHydratedVariables({
        category: "music",
        page: 1,
        sortBy: "name",
      }),
    {
      wrapper: ({ children }) => (
        <ApolloProvider client={client}>{children}</ApolloProvider>
      ),
    }
  );

  const [variables] = await takeSnapshot();
  expect(variables).toStrictEqual({
    category: "electronics",
    page: 2,
    sortBy: "price",
  });

  await expect(takeSnapshot).not.toRerender();
});

test("hydrated variables are only used the first time the component mounts, then uses user vars after", async () => {
  using _ = spyOnConsole("debug");
  const client = new ApolloClient({
    cache: new InMemoryCache(),
    manifest: mockApplicationManifest(),
  });

  using host = await mockMcpHost({
    hostContext: minimalHostContextWithToolName("GetProductsByCategory"),
  });
  host.onCleanup(() => client.stop());

  host.sendToolInput({
    arguments: { category: "electronics", page: 1, sortBy: "title" },
  });
  host.sendToolResult(graphqlToolResult({ data: { products: [] } }));

  const { useHydratedVariables } = createHydrationUtils(PRODUCTS_QUERY);

  using _disabledAct = disableActEnvironment();
  const { replaceSnapshot, render, takeRender } = createRenderStream<
    ReturnType<typeof useHydratedVariables> | undefined
  >();

  function HydratedVariables() {
    replaceSnapshot(
      useHydratedVariables({ category: "music", page: 1, sortBy: "name" })
    );

    return null;
  }

  function App({ mounted }: { mounted: boolean }) {
    replaceSnapshot(undefined);
    return mounted && <HydratedVariables />;
  }

  const { rerender } = await render(<App mounted />, {
    wrapper: ({ children }) => (
      <ApolloProvider client={client}>{children}</ApolloProvider>
    ),
  });

  {
    const { snapshot } = await takeRender();

    assert(snapshot);
    expect(snapshot[0]).toStrictEqual({
      category: "electronics",
      page: 1,
      sortBy: "title",
    });
  }

  await rerender(<App mounted={false} />);

  {
    const { snapshot } = await takeRender();

    expect(snapshot).toBeUndefined();
  }

  await rerender(<App mounted />);

  {
    const { snapshot } = await takeRender();

    assert(snapshot);
    expect(snapshot[0]).toStrictEqual({
      category: "music",
      page: 1,
      sortBy: "name",
    });
  }

  expect(takeRender).not.toRerender();
});

test("hydrated variables are only used the first time the component mounts, then uses user vars after in React strict mode", async () => {
  using _ = spyOnConsole("debug");
  const client = new ApolloClient({
    cache: new InMemoryCache(),
    manifest: mockApplicationManifest(),
  });

  using host = await mockMcpHost({
    hostContext: minimalHostContextWithToolName("GetProductsByCategory"),
  });
  host.onCleanup(() => client.stop());

  host.sendToolInput({
    arguments: { category: "electronics", page: 1, sortBy: "title" },
  });
  host.sendToolResult(graphqlToolResult({ data: { products: [] } }));

  const { useHydratedVariables } = createHydrationUtils(PRODUCTS_QUERY);

  using _disabledAct = disableActEnvironment();

  const { replaceSnapshot, render, takeRender } = createRenderStream<
    ReturnType<typeof useHydratedVariables> | undefined
  >();

  function HydratedVariables() {
    replaceSnapshot(
      useHydratedVariables({ category: "music", page: 1, sortBy: "name" })
    );

    return null;
  }

  function App({ mounted }: { mounted: boolean }) {
    replaceSnapshot(undefined);
    return mounted && <HydratedVariables />;
  }

  const { rerender } = await render(<App mounted />, {
    wrapper: ({ children }) => (
      <StrictMode>
        <ApolloProvider client={client}>{children}</ApolloProvider>
      </StrictMode>
    ),
  });

  {
    const { snapshot } = await takeRender();

    assert(snapshot);
    expect(snapshot[0]).toStrictEqual({
      category: "electronics",
      page: 1,
      sortBy: "title",
    });
  }

  await rerender(<App mounted={false} />);

  {
    const { snapshot } = await takeRender();

    expect(snapshot).toBeUndefined();
  }

  await rerender(<App mounted />);

  {
    const { snapshot } = await takeRender();

    assert(snapshot);
    expect(snapshot[0]).toStrictEqual({
      category: "music",
      page: 1,
      sortBy: "name",
    });
  }

  expect(takeRender).not.toRerender();
});

describe.skip("type tests", () => {
  test("TypeScript rejects variables not defined in TVariables", () => {
    const { useHydratedVariables } = createHydrationUtils(PRODUCTS_QUERY);

    useHydratedVariables({
      category: "test",
      page: 1,
      sortBy: "asc",
      // @ts-expect-error extra key 'unknownVar' is not in TVariables
      unknownVar: "bad",
    });
  });
});
