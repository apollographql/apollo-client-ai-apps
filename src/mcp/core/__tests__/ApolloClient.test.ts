import { expect, test, vi, describe } from "vitest";
import { ApolloClient } from "../ApolloClient.js";
import {
  ApolloLink,
  HttpLink,
  InMemoryCache,
  NetworkStatus,
  gql,
  type DocumentNode,
} from "@apollo/client";
import { print } from "@apollo/client/utilities";
import { ToolCallLink } from "../../link/ToolCallLink.js";
import {
  graphqlToolResult,
  minimalHostContextWithToolName,
  mockApplicationManifest,
  mockMcpHost,
  ObservableStream,
  parseManifestOperation,
  spyOnConsole,
} from "../../../testing/internal/index.js";

test("writes tool result data to cache", async () => {
  using _ = spyOnConsole("debug");

  const query = gql`
    query Product($id: ID!) {
      product(id: $id) {
        id
        title
        __typename
      }
    }
  `;

  const client = new ApolloClient({
    cache: new InMemoryCache(),
    manifest: mockApplicationManifest({
      operations: [
        {
          id: "1",
          name: "Product",
          body: print(query),
          type: "query",
          prefetch: false,
          variables: { id: "ID" },
          tools: [{ name: "GetProduct", description: "Get a product" }],
        },
      ],
    }),
  });

  using host = await mockMcpHost({
    hostContext: minimalHostContextWithToolName("GetProduct"),
  });
  host.onCleanup(() => client.stop());

  host.sendToolResult({
    content: [],
    structuredContent: {
      result: {
        data: {
          product: { id: "1", title: "Pen", __typename: "Product" },
        },
      },
    },
  });
  host.sendToolInput({ arguments: { id: "1" } });

  await client.connect();

  expect(client.extract()).toEqual({
    "Product:1": {
      __typename: "Product",
      id: "1",
      title: "Pen",
    },
    ROOT_QUERY: {
      __typename: "Query",
      'product({"id":"1"})': {
        __ref: "Product:1",
      },
    },
  });
});

test("writes prefetch data to cache", async () => {
  using _ = spyOnConsole("debug");

  const query = gql`
    query TopProducts {
      topProducts {
        id
        title
        __typename
      }
    }
  `;

  const client = new ApolloClient({
    cache: new InMemoryCache(),
    manifest: mockApplicationManifest({
      operations: [
        {
          id: "1",
          name: "TopProducts",
          body: print(query),
          type: "query",
          prefetch: true,
          prefetchID: "__anonymous",
          variables: {},
          tools: [{ name: "TopProducts", description: "Shows top products" }],
        },
      ],
    }),
  });

  using host = await mockMcpHost({
    hostContext: minimalHostContextWithToolName("OtherTool"),
  });
  host.onCleanup(() => client.stop());

  host.sendToolResult({
    content: [],
    structuredContent: {
      prefetch: {
        __anonymous: {
          data: {
            topProducts: [{ id: "1", title: "iPhone", __typename: "Product" }],
          },
        },
      },
    },
  });
  host.sendToolInput({ arguments: {} });

  await client.connect();

  expect(client.extract()).toEqual({
    "Product:1": {
      __typename: "Product",
      id: "1",
      title: "iPhone",
    },
    ROOT_QUERY: {
      __typename: "Query",
      topProducts: [{ __ref: "Product:1" }],
    },
  });
});

test("writes prefetch and tool response data to cache when both are provided", async () => {
  using _ = spyOnConsole("debug");

  const prefetchQuery = gql`
    query TopProducts {
      topProducts {
        id
        title
        __typename
      }
    }
  `;

  const query = gql`
    query Product($id: ID!) {
      product(id: $id) {
        id
        title
        __typename
      }
    }
  `;

  const client = new ApolloClient({
    cache: new InMemoryCache(),
    manifest: mockApplicationManifest({
      operations: [
        {
          id: "1",
          name: "TopProducts",
          body: print(prefetchQuery),
          type: "query",
          prefetch: true,
          prefetchID: "__anonymous",
          variables: {},
          tools: [{ name: "TopProducts", description: "Shows top products" }],
        },
        {
          id: "2",
          name: "Product",
          body: print(query),
          type: "query",
          prefetch: false,
          variables: { id: "ID" },
          tools: [{ name: "Product", description: "Get a product by id" }],
        },
      ],
    }),
  });

  using host = await mockMcpHost({
    hostContext: minimalHostContextWithToolName("Product"),
  });
  host.onCleanup(() => client.stop());

  host.sendToolResult({
    content: [],
    structuredContent: {
      prefetch: {
        __anonymous: {
          data: {
            topProducts: [{ id: "1", title: "iPhone", __typename: "Product" }],
          },
        },
      },
      result: {
        data: {
          product: { __typename: "Product", id: "2", title: "iPad" },
        },
      },
    },
  });
  host.sendToolInput({ arguments: { id: "2" } });

  await client.connect();

  expect(client.extract()).toEqual({
    "Product:1": {
      __typename: "Product",
      id: "1",
      title: "iPhone",
    },
    "Product:2": {
      __typename: "Product",
      id: "2",
      title: "iPad",
    },
    ROOT_QUERY: {
      __typename: "Query",
      topProducts: [{ __ref: "Product:1" }],
      'product({"id":"2"})': { __ref: "Product:2" },
    },
  });
});

test("excludes extra tool input variables not defined in the operation", async () => {
  using _ = spyOnConsole("debug");

  const query = gql`
    query Product($id: ID!) {
      product(id: $id) {
        id
        title
        __typename
      }
    }
  `;

  const client = new ApolloClient({
    cache: new InMemoryCache(),
    manifest: mockApplicationManifest({
      operations: [
        {
          id: "1",
          name: "Product",
          body: print(query),
          type: "query",
          prefetch: false,
          variables: { id: "ID" },
          tools: [{ name: "GetProduct", description: "Get a product" }],
        },
      ],
    }),
  });

  using host = await mockMcpHost({
    hostContext: minimalHostContextWithToolName("GetProduct"),
  });
  host.onCleanup(() => client.stop());

  host.sendToolResult({
    content: [],
    structuredContent: {
      result: {
        data: {
          product: { id: "1", title: "Pen", __typename: "Product" },
        },
      },
    },
  });
  host.sendToolInput({ arguments: { id: "1", extraParam: "ignored" } });

  await client.connect();

  expect(client.extract()).toEqual({
    "Product:1": {
      __typename: "Product",
      id: "1",
      title: "Pen",
    },
    ROOT_QUERY: {
      __typename: "Query",
      'product({"id":"1"})': {
        __ref: "Product:1",
      },
    },
  });
});

test("allows for custom links provided to the constructor", async () => {
  using _ = spyOnConsole("debug");
  const manifest = mockApplicationManifest();
  const linkHandler = vi.fn<ApolloLink.RequestHandler>((operation, forward) =>
    forward(operation)
  );

  const client = new ApolloClient({
    manifest,
    cache: new InMemoryCache(),
    link: ApolloLink.from([new ApolloLink(linkHandler), new ToolCallLink()]),
  });

  using host = await mockMcpHost({
    hostContext: minimalHostContextWithToolName("GetProduct"),
  });
  host.onCleanup(() => client.stop());

  host.sendToolResult({
    content: [],
    structuredContent: {
      result: {
        data: {
          product: { id: "1", title: "Pen", __typename: "Product" },
        },
      },
    },
  });
  host.sendToolInput({ arguments: {} });

  host.mockToolCall("execute", () => ({
    content: [],
    structuredContent: {
      data: {
        product: {
          id: "1",
          title: "Pen",
          rating: 5,
          price: 1.0,
          description: "Awesome pen",
          images: [],
          __typename: "Product",
        },
      },
    },
  }));

  await client.connect();

  const variables = { id: "1" };
  const query = gql(manifest.operations[0].body);

  await expect(client.query({ query, variables })).resolves.toStrictEqual({
    data: {
      product: {
        id: "1",
        title: "Pen",
        rating: 5,
        price: 1.0,
        description: "Awesome pen",
        images: [],
        __typename: "Product",
      },
    },
  });

  expect(linkHandler).toHaveBeenCalledOnce();
  expect(linkHandler).toHaveBeenCalledWith(
    expect.objectContaining({ query, variables, operationType: "query" }),
    expect.any(Function)
  );
});

test("enforces ToolCallLink as terminating link", () => {
  const manifest = mockApplicationManifest();
  const expectedError = new Error(
    "The terminating link must be a `ToolCallLink`. If you are using a `split` link, ensure the `right` branch uses a `ToolCallLink` as the terminating link."
  );

  expect(() => {
    new ApolloClient({
      manifest,
      cache: new InMemoryCache(),
      link: new HttpLink(),
    });
  }).toThrow(expectedError);

  expect(() => {
    new ApolloClient({
      manifest,
      cache: new InMemoryCache(),
      link: new ApolloLink(),
    });
  }).toThrow(expectedError);

  expect(() => {
    new ApolloClient({
      manifest,
      cache: new InMemoryCache(),
      link: ApolloLink.from([new ApolloLink(), new HttpLink()]),
    });
  }).toThrow(expectedError);

  expect(() => {
    new ApolloClient({
      manifest,
      cache: new InMemoryCache(),
      link: ApolloLink.split(() => true, new ToolCallLink(), new HttpLink()),
    });
  }).toThrow(expectedError);

  // Allow you to use a custom terminating link for `split` links if the
  // custom link is the `left` branch link.
  expect(() => {
    new ApolloClient({
      manifest,
      cache: new InMemoryCache(),
      link: ApolloLink.split(() => true, new HttpLink(), new ToolCallLink()),
    });
  }).not.toThrow(expectedError);

  expect(() => {
    new ApolloClient({
      manifest,
      cache: new InMemoryCache(),
      link: ApolloLink.split(
        () => true,
        new ToolCallLink(),
        new ToolCallLink()
      ),
    });
  }).not.toThrow();
});

test("allows ToolCallLink as terminating link", () => {
  const manifest = mockApplicationManifest();

  expect(() => {
    new ApolloClient({
      manifest,
      cache: new InMemoryCache(),
      link: ApolloLink.from([new ApolloLink(), new ToolCallLink()]),
    });
  }).not.toThrow();

  expect(() => {
    new ApolloClient({
      manifest,
      cache: new InMemoryCache(),
      link: ApolloLink.split(() => true, new HttpLink(), new ToolCallLink()),
    });
  }).not.toThrow();
});

test("creates a default ToolCallLink when no link is provided", () => {
  const manifest = mockApplicationManifest();

  expect(() => {
    new ApolloClient({
      manifest,
      cache: new InMemoryCache(),
    });
  }).not.toThrow();
});

test("reads result data from _meta.structuredContent", async () => {
  using _ = spyOnConsole("debug");

  const query = gql`
    query Product($id: ID!) {
      product(id: $id) @private {
        id
        title
        __typename
      }
    }
  `;

  const client = new ApolloClient({
    cache: new InMemoryCache(),
    manifest: mockApplicationManifest({
      operations: [
        {
          id: "1",
          name: "Product",
          body: print(query),
          type: "query",
          prefetch: false,
          variables: { id: "ID" },
          tools: [{ name: "GetProduct", description: "Get a product" }],
        },
      ],
    }),
  });

  using host = await mockMcpHost({
    hostContext: minimalHostContextWithToolName("GetProduct"),
  });
  host.onCleanup(() => client.stop());

  host.sendToolResult({
    content: [],
    structuredContent: {},
    _meta: {
      toolName: "GetProduct",
      structuredContent: {
        result: {
          data: {
            product: { id: "1", title: "Pen", __typename: "Product" },
          },
        },
      },
    },
  });
  host.sendToolInput({ arguments: { id: "1" } });

  await client.connect();

  expect(client.extract()).toEqual({
    "Product:1": {
      __typename: "Product",
      id: "1",
      title: "Pen",
    },
    ROOT_QUERY: {
      __typename: "Query",
      'product({"id":"1"})@private': {
        __ref: "Product:1",
      },
    },
  });
});

test("merges prefetch from structuredContent and result from _meta.structuredContent", async () => {
  using _ = spyOnConsole("debug");

  const prefetchQuery = gql`
    query TopProducts {
      topProducts {
        id
        title
        __typename
      }
    }
  `;

  const query = gql`
    query Product($id: ID!) {
      product(id: $id) @private {
        id
        title
        __typename
      }
    }
  `;

  const client = new ApolloClient({
    cache: new InMemoryCache(),
    manifest: mockApplicationManifest({
      operations: [
        {
          id: "1",
          name: "TopProducts",
          body: print(prefetchQuery),
          type: "query",
          prefetch: true,
          prefetchID: "__anonymous",
          variables: {},
          tools: [{ name: "TopProducts", description: "Shows top products" }],
        },
        {
          id: "2",
          name: "Product",
          body: print(query),
          type: "query",
          prefetch: false,
          variables: { id: "ID" },
          tools: [{ name: "GetProduct", description: "Get a product" }],
        },
      ],
    }),
  });

  using host = await mockMcpHost({
    hostContext: minimalHostContextWithToolName("GetProduct"),
  });
  host.onCleanup(() => client.stop());

  host.sendToolResult({
    content: [],
    structuredContent: {
      prefetch: {
        __anonymous: {
          data: {
            topProducts: [{ id: "1", title: "iPhone", __typename: "Product" }],
          },
        },
      },
    },
    _meta: {
      toolName: "GetProduct",
      structuredContent: {
        result: {
          data: {
            product: { id: "2", title: "iPad", __typename: "Product" },
          },
        },
      },
    },
  });
  host.sendToolInput({ arguments: { id: "2" } });

  await client.connect();

  expect(client.extract()).toEqual({
    "Product:1": {
      __typename: "Product",
      id: "1",
      title: "iPhone",
    },
    "Product:2": {
      __typename: "Product",
      id: "2",
      title: "iPad",
    },
    ROOT_QUERY: {
      __typename: "Query",
      topProducts: [{ __ref: "Product:1" }],
      'product({"id":"2"})@private': { __ref: "Product:2" },
    },
  });
});

test("_meta.structuredContent wins over structuredContent", async () => {
  using _ = spyOnConsole("debug");

  const query = gql`
    query Product($id: ID!) {
      product(id: $id) {
        id
        title @private
        __typename
      }
    }
  `;

  const client = new ApolloClient({
    cache: new InMemoryCache(),
    manifest: mockApplicationManifest({
      operations: [
        {
          id: "1",
          name: "Product",
          body: print(query),
          type: "query",
          prefetch: false,
          variables: { id: "ID" },
          tools: [{ name: "GetProduct", description: "Get a product" }],
        },
      ],
    }),
  });

  using host = await mockMcpHost({
    hostContext: minimalHostContextWithToolName("GetProduct"),
  });
  host.onCleanup(() => client.stop());

  host.sendToolResult({
    content: [],
    structuredContent: {
      result: {
        data: {
          product: { id: "1", __typename: "Product" },
        },
      },
    },
    _meta: {
      toolName: "GetProduct",
      structuredContent: {
        result: {
          data: {
            product: { id: "1", title: "Meta title", __typename: "Product" },
          },
        },
      },
    },
  });
  host.sendToolInput({ arguments: { id: "1" } });

  await client.connect();

  expect(client.extract()).toEqual({
    "Product:1": {
      __typename: "Product",
      id: "1",
      "title@private": "Meta title",
    },
    ROOT_QUERY: {
      __typename: "Query",
      'product({"id":"1"})': {
        __ref: "Product:1",
      },
    },
  });
});

test("serves tool result data on network-only query without calling execute tool", async () => {
  using _ = spyOnConsole("debug");
  const query = gql`
    query Product($id: ID!)
    @tool(name: "GetProduct", description: "Get a product") {
      product(id: $id) {
        id
        title
        __typename
      }
    }
  `;

  const data = {
    product: { id: "1", title: "Pen", __typename: "Product" },
  };

  const { client, host } = await setup({ query });
  using _host = host;

  const execute = vi.fn();
  host.mockToolCall("execute", execute);

  host.sendToolResult({ structuredContent: { result: { data } } });
  host.sendToolInput({ arguments: { id: "1" } });

  await client.connect();

  await expect(
    client.query({
      query,
      variables: { id: "1" },
      fetchPolicy: "network-only",
    })
  ).resolves.toStrictEqual({ data });
  expect(execute).not.toHaveBeenCalled();
});

test("calls execute tool on second network-only query after hydration is consumed", async () => {
  using _ = spyOnConsole("debug");
  const query = gql`
    query Product($id: ID!)
    @tool(name: "GetProduct", description: "Get a product") {
      product(id: $id) {
        id
        title
        __typename
      }
    }
  `;

  const { client, host } = await setup({ query });
  using _host = host;

  host.mockToolCall("execute", () => ({
    structuredContent: {
      data: {
        product: { id: "1", title: "Updated Pen", __typename: "Product" },
      },
    },
  }));

  host.sendToolResult({
    structuredContent: {
      result: {
        data: {
          product: { id: "1", title: "Pen", __typename: "Product" },
        },
      },
    },
  });
  host.sendToolInput({ arguments: { id: "1" } });

  await client.connect();

  await client.query({
    query,
    variables: { id: "1" },
    fetchPolicy: "network-only",
  });

  await expect(
    client.query({
      query,
      variables: { id: "1" },
      fetchPolicy: "network-only",
    })
  ).resolves.toStrictEqual({
    data: {
      product: { id: "1", title: "Updated Pen", __typename: "Product" },
    },
  });
});

test("serves tool result data on cache-and-network query without calling execute tool", async () => {
  using _ = spyOnConsole("debug");
  const query = gql`
    query Product($id: ID!)
    @tool(name: "GetProduct", description: "Get a product") {
      product(id: $id) {
        id
        title
        __typename
      }
    }
  `;

  const { client, host } = await setup({ query });
  using _host = host;

  const execute = vi.fn();
  host.mockToolCall("execute", execute);

  host.sendToolResult({
    structuredContent: {
      result: {
        data: {
          product: { id: "1", title: "Pen", __typename: "Product" },
        },
      },
    },
  });
  host.sendToolInput({ arguments: { id: "1" } });

  await client.connect();

  const stream = new ObservableStream(
    client.watchQuery({
      query,
      variables: { id: "1" },
      fetchPolicy: "cache-and-network",
    })
  );

  // The hydrated result is emitted synchronously so we won't observe a loading
  // state like we normally would with `cache-and-network`
  await expect(stream).toEmitValue({
    data: { product: { id: "1", title: "Pen", __typename: "Product" } },
    dataState: "complete",
    loading: false,
    networkStatus: NetworkStatus.ready,
    partial: false,
  });

  await expect(stream).not.toEmitAnything();

  expect(execute).not.toHaveBeenCalled();
});

test("holds queries initiated before tool result arrives and resolves with tool result data", async () => {
  using _ = spyOnConsole("debug");
  const query = gql`
    query Product($id: ID!)
    @tool(name: "GetProduct", description: "Get a product") {
      product(id: $id) {
        id
        title
        __typename
      }
    }
  `;

  const data = {
    product: { id: "1", title: "Pen", __typename: "Product" },
  };

  const { client, host } = await setup({ query });
  using _host = host;

  const execute = vi.fn();
  host.mockToolCall("execute", execute);

  // Send tool input first so connect() resolves, but don't send tool result yet
  host.sendToolInput({ arguments: { id: "1" } });

  await client.connect();

  // Start query before tool result arrives to check if it is queued correctly
  const promise = client.query({
    query,
    variables: { id: "1" },
    fetchPolicy: "network-only",
  });

  host.sendToolResult({ structuredContent: { result: { data } } });

  await expect(promise).resolves.toStrictEqual({ data });
  expect(execute).not.toHaveBeenCalled();
});

test("executes prefetch query on the network with network-only fetch policy", async () => {
  using _ = spyOnConsole("debug");

  const query = gql`
    query TopProducts @tool(description: "Shows top products") @prefetch {
      topProducts {
        id
        title
        __typename
      }
    }
  `;

  const data = {
    topProducts: [{ id: "1", title: "iPhone", __typename: "Product" }],
  };

  const { client, host } = await setup({ query, toolName: "OtherTool" });
  using _host = host;

  host.mockToolCall("execute", () => ({
    structuredContent: {
      data: {
        topProducts: [
          { id: "1", title: "iPhone Pro Max", __typename: "Product" },
        ],
      },
    },
  }));

  host.sendToolResult({
    structuredContent: {
      prefetch: { __anonymous: { data } },
    },
  });
  host.sendToolInput({ arguments: {} });

  await client.connect();

  await expect(
    client.query({ query, fetchPolicy: "network-only" })
  ).resolves.toStrictEqual({
    data: {
      topProducts: [
        { id: "1", title: "iPhone Pro Max", __typename: "Product" },
      ],
    },
  });
});

describe("watchQuery dev warnings", () => {
  const query = gql`
    query Products($category: String!, $page: Int!, $sortBy: String!)
    @tool(name: "GetProductsByCategory") {
      products(category: $category, page: $page, sortBy: $sortBy) {
        id
      }
    }
  `;

  async function setupClient({
    toolInput,
  }: {
    toolInput: Record<string, unknown>;
  }) {
    const client = new ApolloClient({
      cache: new InMemoryCache(),
      manifest: mockApplicationManifest(),
    });
    using host = await mockMcpHost({
      hostContext: minimalHostContextWithToolName("GetProductsByCategory"),
    });
    host.onCleanup(() => client.stop());
    host.sendToolResult(graphqlToolResult({ data: { products: [] } }));
    host.sendToolInput({ arguments: toolInput });
    await client.connect();
    return client;
  }

  test("warns when variables don't match tool input", async () => {
    using _ = spyOnConsole("debug", "warn");
    const client = await setupClient({
      toolInput: { category: "electronics", page: 1, sortBy: "title" },
    });

    client.watchQuery({
      query,
      variables: { category: "music", page: 1, sortBy: "name" },
    });

    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining("useHydratedVariables"),
      { category: "electronics", page: 1, sortBy: "title" },
      { category: "music", page: 1, sortBy: "name" }
    );
  });

  test("does not warn when variables match tool input", async () => {
    using _ = spyOnConsole("debug", "warn");
    const client = await setupClient({
      toolInput: { category: "electronics", page: 1, sortBy: "title" },
    });

    client.watchQuery({
      query,
      variables: { category: "electronics", page: 1, sortBy: "title" },
    });

    expect(console.warn).not.toHaveBeenCalled();
  });

  test("does not warn when query has no matching @tool directive", async () => {
    using _ = spyOnConsole("debug", "warn");
    const client = await setupClient({
      toolInput: { category: "electronics", page: 1, sortBy: "title" },
    });

    const queryWithoutTool = gql`
      query Products($category: String!) {
        products(category: $category) {
          id
        }
      }
    `;

    client.watchQuery({
      query: queryWithoutTool,
      variables: { category: "music" },
    });

    expect(console.warn).not.toHaveBeenCalled();
  });

  test("warning fires at most once (subsequent calls don't re-warn)", async () => {
    using _ = spyOnConsole("debug", "warn");
    const client = await setupClient({
      toolInput: { category: "electronics", page: 1, sortBy: "title" },
    });

    client.watchQuery({
      query,
      variables: { category: "music", page: 1, sortBy: "name" },
    });
    client.watchQuery({
      query,
      variables: { category: "music", page: 1, sortBy: "name" },
    });

    expect(console.warn).toHaveBeenCalledTimes(1);
  });
});

async function setup({
  query,
  toolName,
}: {
  query: DocumentNode;
  toolName?: string;
}) {
  const operation = parseManifestOperation(query);
  const client = new ApolloClient({
    cache: new InMemoryCache(),
    manifest: mockApplicationManifest({ operations: [operation] }),
  });

  const host = await mockMcpHost({
    hostContext: minimalHostContextWithToolName(
      toolName ?? operation.tools[0].name
    ),
  });
  host.onCleanup(() => client.stop());

  return { client, host };
}
