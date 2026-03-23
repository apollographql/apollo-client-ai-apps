import { expect, test, describe, vi } from "vitest";
import { ApolloClient } from "../ApolloClient.js";
import { parse, type DocumentNode } from "graphql";
import {
  ApolloLink,
  HttpLink,
  InMemoryCache,
  NetworkStatus,
  gql,
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
  stubOpenAiGlobals,
} from "../../../testing/internal/index.js";

describe("Client Basics", () => {
  test("executes tool call when client.query is called", async () => {
    stubOpenAiGlobals();
    using _ = spyOnConsole("debug");
    const manifest = mockApplicationManifest();
    const client = new ApolloClient({
      cache: new InMemoryCache(),
      manifest,
    });
    using host = await mockMcpHost();

    host.onCleanup(() => client.stop());

    host.sendToolInput({});
    host.sendToolResult({
      content: [],
      structuredContent: {},
    });

    await client.connect();

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

    const variables = { id: "1" };
    const result = await client.query({
      query: parse(manifest.operations[0].body),
      variables,
    });

    expect(result).toEqual({
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
    expect(client.extract()).toMatchInlineSnapshot(`
      {
        "Product:1": {
          "__typename": "Product",
          "description": "Awesome pen",
          "id": "1",
          "images": [],
          "price": 1,
          "rating": 5,
          "title": "Pen",
        },
        "ROOT_QUERY": {
          "__typename": "Query",
          "product({"id":"1"})": {
            "__ref": "Product:1",
          },
        },
      }
    `);
  });
});

test("merges _meta.structuredContent into result for @private fields", async () => {
  stubOpenAiGlobals();
  using _ = spyOnConsole("debug");
  const manifest = mockApplicationManifest();
  const client = new ApolloClient({
    cache: new InMemoryCache(),
    manifest,
  });
  using host = await mockMcpHost();

  const query = gql`
    query Product {
      id
      title @private
    }
  `;

  host.onCleanup(() => client.stop());

  host.sendToolInput({});
  host.sendToolResult({
    content: [],
    structuredContent: {},
  });

  host.mockToolCall("execute", () => ({
    content: [],
    structuredContent: {},
    _meta: {
      structuredContent: {
        data: {
          product: {
            id: "1",
            title: "Private Pen",
            __typename: "Product",
          },
        },
      },
    },
  }));

  await client.connect();

  await expect(
    client.query({ query, variables: { id: "1" } })
  ).resolves.toStrictEqual({
    data: {
      product: {
        __typename: "Product",
        id: "1",
        title: "Private Pen",
      },
    },
  });
});

describe("prefetchData", () => {
  test("caches tool response when data is provided", async () => {
    stubOpenAiGlobals({ toolInput: { id: 1 } });
    using _ = spyOnConsole("debug");
    const client = new ApolloClient({
      cache: new InMemoryCache(),
      manifest: mockApplicationManifest(),
    });
    using host = await mockMcpHost({
      hostContext: minimalHostContextWithToolName("GetProduct"),
    });

    host.onCleanup(() => client.stop());

    host.sendToolInput({ arguments: { id: 1 } });
    host.sendToolResult({
      content: [],
      structuredContent: {
        result: {
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
      },
    });

    await client.connect();

    expect(client.extract()).toMatchInlineSnapshot(`
      {
        "Product:1": {
          "__typename": "Product",
          "description": "Awesome pen",
          "id": "1",
          "images": [],
          "price": 1,
          "rating": 5,
          "title": "Pen",
        },
        "ROOT_QUERY": {
          "__typename": "Query",
          "product({"id":1})": {
            "__ref": "Product:1",
          },
        },
      }
    `);
  });

  test("caches prefetched data when prefetched data is provided", async () => {
    stubOpenAiGlobals({ toolInput: { id: 1 } });
    using _ = spyOnConsole("debug");
    const client = new ApolloClient({
      cache: new InMemoryCache(),
      manifest: mockApplicationManifest({
        operations: [
          {
            id: "cd0d52159b9003e791de97c6a76efa03d34fe00cee278d1a3f4bfcec5fb3e1e6",
            name: "TopProducts",
            type: "query",
            body: "query TopProducts {\n  topProducts {\n    id\n    title\n    rating\n    price\n    __typename\n  }\n}",
            variables: {},
            prefetch: true,
            prefetchID: "__anonymous",
            tools: [
              {
                name: "TopProducts",
                description: "Shows the currently highest rated products.",
              },
            ],
          },
        ],
      }),
    });
    using host = await mockMcpHost({
      hostContext: minimalHostContextWithToolName("GetProduct"),
    });

    host.onCleanup(() => client.stop());

    host.sendToolInput({ arguments: { id: 1 } });
    host.sendToolResult({
      content: [],
      structuredContent: {
        prefetch: {
          __anonymous: {
            data: {
              topProducts: [
                {
                  id: "2",
                  title: "iPhone 17",
                  rating: 5,
                  price: 999.99,
                  description: "Awesome phone",
                  images: [],
                  __typename: "Product",
                },
              ],
            },
          },
        },
      },
    });

    await client.connect();

    expect(client.extract()).toMatchInlineSnapshot(`
      {
        "Product:2": {
          "__typename": "Product",
          "id": "2",
          "price": 999.99,
          "rating": 5,
          "title": "iPhone 17",
        },
        "ROOT_QUERY": {
          "__typename": "Query",
          "topProducts": [
            {
              "__ref": "Product:2",
            },
          ],
        },
      }
    `);
  });

  test("caches both prefetch and tool response when both are provided", async () => {
    stubOpenAiGlobals({ toolInput: { id: 1 } });
    using _ = spyOnConsole("debug");
    const client = new ApolloClient({
      cache: new InMemoryCache(),
      manifest: mockApplicationManifest({
        operations: [
          {
            id: "c43af26552874026c3fb346148c5795896aa2f3a872410a0a2621cffee25291c",
            name: "Product",
            type: "query",
            body: "query Product($id: ID!) {\n  product(id: $id) {\n    id\n    title\n    rating\n    price\n    description\n    images\n    __typename\n  }\n}",
            variables: { id: "ID" },
            prefetch: false,
            tools: [
              {
                name: "GetProduct",
                description: "Shows the details page for a specific product.",
              },
            ],
          },
          {
            id: "cd0d52159b9003e791de97c6a76efa03d34fe00cee278d1a3f4bfcec5fb3e1e6",
            name: "TopProducts",
            type: "query",
            body: "query TopProducts {\n  topProducts {\n    id\n    title\n    rating\n    price\n    __typename\n  }\n}",
            variables: {},
            prefetch: true,
            prefetchID: "__anonymous",
            tools: [
              {
                name: "TopProducts",
                description: "Shows the currently highest rated products.",
              },
            ],
          },
        ],
      }),
    });
    using host = await mockMcpHost({
      hostContext: minimalHostContextWithToolName("GetProduct"),
    });

    host.onCleanup(() => client.stop());

    host.sendToolInput({ arguments: { id: 1 } });
    host.sendToolResult({
      content: [],
      structuredContent: {
        result: {
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
        prefetch: {
          __anonymous: {
            data: {
              topProducts: [
                {
                  id: "2",
                  title: "iPhone 17",
                  rating: 5,
                  price: 999.99,
                  description: "Awesome phone",
                  images: [],
                  __typename: "Product",
                },
              ],
            },
          },
        },
      },
    });

    await client.connect();

    expect(client.extract()).toMatchInlineSnapshot(`
      {
        "Product:1": {
          "__typename": "Product",
          "description": "Awesome pen",
          "id": "1",
          "images": [],
          "price": 1,
          "rating": 5,
          "title": "Pen",
        },
        "Product:2": {
          "__typename": "Product",
          "id": "2",
          "price": 999.99,
          "rating": 5,
          "title": "iPhone 17",
        },
        "ROOT_QUERY": {
          "__typename": "Query",
          "product({"id":1})": {
            "__ref": "Product:1",
          },
          "topProducts": [
            {
              "__ref": "Product:2",
            },
          ],
        },
      }
    `);
  });

  test("excludes extra inputs when writing to cache", async () => {
    stubOpenAiGlobals({ toolInput: { id: 1, myOtherThing: 2 } });
    using _ = spyOnConsole("debug");
    const client = new ApolloClient({
      cache: new InMemoryCache(),
      manifest: mockApplicationManifest(),
    });
    using host = await mockMcpHost({
      hostContext: minimalHostContextWithToolName("GetProduct"),
    });

    host.onCleanup(() => client.stop());

    host.sendToolInput({ arguments: { id: 1, myOtherThing: 2 } });
    host.sendToolResult({
      content: [],
      structuredContent: {
        result: {
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
      },
    });

    await client.connect();

    expect(client.extract()).toMatchInlineSnapshot(`
      {
        "Product:1": {
          "__typename": "Product",
          "description": "Awesome pen",
          "id": "1",
          "images": [],
          "price": 1,
          "rating": 5,
          "title": "Pen",
        },
        "ROOT_QUERY": {
          "__typename": "Query",
          "product({"id":1})": {
            "__ref": "Product:1",
          },
        },
      }
    `);
  });
});

test("reads result data from toolResponseMetadata.structuredContent", async () => {
  stubOpenAiGlobals({
    toolInput: { id: "1" },
    toolResponseMetadata: {
      structuredContent: {
        result: {
          data: {
            product: { id: "1", title: "Pen", __typename: "Product" },
          },
        },
      },
    },
  });
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
          id: "c43af26552874026c3fb346148c5795896aa2f3a872410a0a2621cffee25291c",
          name: "Product",
          type: "query",
          body: print(query),
          variables: { id: "ID" },
          prefetch: false,
          tools: [{ name: "GetProduct", description: "Get a product" }],
        },
      ],
    }),
  });
  using host = await mockMcpHost({
    hostContext: minimalHostContextWithToolName("GetProduct"),
  });
  host.onCleanup(() => client.stop());

  host.sendToolInput({ arguments: { id: "1" } });
  host.sendToolResult({
    content: [],
    structuredContent: {},
  });

  await client.connect();

  expect(client.extract()).toEqual({
    "Product:1": {
      __typename: "Product",
      id: "1",
      title: "Pen",
    },
    ROOT_QUERY: {
      __typename: "Query",
      'product({"id":"1"})@private': { __ref: "Product:1" },
    },
  });
});

test("merges prefetch from structuredContent and result from toolResponseMetadata.structuredContent", async () => {
  stubOpenAiGlobals({
    toolInput: { id: "2" },
    toolResponseMetadata: {
      structuredContent: {
        result: {
          data: {
            product: { id: "2", title: "iPad", __typename: "Product" },
          },
        },
      },
    },
  });
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
          variables: {},
          prefetch: true,
          prefetchID: "__anonymous",
          tools: [
            {
              name: "TopProducts",
              description: "Shows the currently highest rated products.",
            },
          ],
        },
        {
          id: "2",
          name: "Product",
          body: print(query),
          type: "query",
          variables: { id: "ID" },
          prefetch: false,
          tools: [{ name: "GetProduct", description: "Get a product" }],
        },
      ],
    }),
  });
  using host = await mockMcpHost({
    hostContext: minimalHostContextWithToolName("GetProduct"),
  });
  host.onCleanup(() => client.stop());

  host.sendToolInput({ arguments: { id: "2" } });
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

test("toolResponseMetadata.structuredContent wins over structuredContent", async () => {
  stubOpenAiGlobals({
    toolInput: { id: "1" },
    toolResponseMetadata: {
      structuredContent: {
        result: {
          data: {
            product: { id: "1", title: "Meta title", __typename: "Product" },
          },
        },
      },
    },
  });
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
          variables: { id: "ID" },
          prefetch: false,
          tools: [{ name: "GetProduct", description: "Get a product" }],
        },
      ],
    }),
  });
  using host = await mockMcpHost({
    hostContext: minimalHostContextWithToolName("GetProduct"),
  });
  host.onCleanup(() => client.stop());

  host.sendToolInput({ arguments: { id: "1" } });
  host.sendToolResult({
    content: [],
    structuredContent: {
      result: {
        data: {
          product: { id: "1", __typename: "Product" },
        },
      },
    },
  });

  await client.connect();

  expect(client.extract()).toEqual({
    "Product:1": {
      __typename: "Product",
      id: "1",
      "title@private": "Meta title",
    },
    ROOT_QUERY: {
      __typename: "Query",
      'product({"id":"1"})': { __ref: "Product:1" },
    },
  });
});

test("connects using window.openai.toolOutput when tool-result notification is not sent", async () => {
  stubOpenAiGlobals({
    toolOutput: {
      result: {
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
    },
    toolInput: { id: "1" },
  });
  using _ = spyOnConsole("debug");
  const client = new ApolloClient({
    cache: new InMemoryCache(),
    manifest: mockApplicationManifest(),
  });
  using host = await mockMcpHost({
    hostContext: minimalHostContextWithToolName("GetProduct"),
  });
  host.onCleanup(() => client.stop());

  host.sendToolInput({ arguments: { id: "1" } });
  // No host.sendToolResult() — simulates page reload where ChatGPT does not
  // re-send the tool-result notification

  await client.connect();

  // Flush pending setImmediate callbacks (e.g. ResizeObserver in happy-dom)
  // before `using host` disposes and closes the app connection.
  await new Promise((resolve) => setImmediate(resolve));

  expect(client.extract()).toMatchInlineSnapshot(`
    {
      "Product:1": {
        "__typename": "Product",
        "description": "Awesome pen",
        "id": "1",
        "images": [],
        "price": 1,
        "rating": 5,
        "title": "Pen",
      },
      "ROOT_QUERY": {
        "__typename": "Query",
        "product({"id":"1"})": {
          "__ref": "Product:1",
        },
      },
    }
  `);
});

describe("custom links", () => {
  test("allows for custom links provided to the constructor", async () => {
    stubOpenAiGlobals();
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

    using host = await mockMcpHost();
    host.onCleanup(() => client.stop());

    host.sendToolInput({ arguments: {} });
    host.sendToolResult({
      content: [],
      structuredContent: {},
    });

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
    const query = parse(manifest.operations[0].body);

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

  test("enforces ToolCallLink as terminating link", async () => {
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
        link: ApolloLink.split(() => true, new ApolloLink(), new HttpLink()),
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
});

test("serves tool result data on network-only query without calling execute tool", async () => {
  stubOpenAiGlobals({ toolInput: { id: "1" } });
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
  stubOpenAiGlobals({ toolInput: { id: "1" } });
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
  stubOpenAiGlobals({ toolInput: { id: "1" } });
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

test("serves tool result data on no-cache query without calling execute tool and does not write to cache", async () => {
  stubOpenAiGlobals({ toolInput: { id: "1" } });
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

  host.sendToolInput({ arguments: { id: "1" } });
  host.sendToolResult({ structuredContent: { result: { data } } });

  await client.connect();

  await expect(
    client.query({ query, variables: { id: "1" }, fetchPolicy: "no-cache" })
  ).resolves.toStrictEqual({ data });
  expect(execute).not.toHaveBeenCalled();
  expect(client.extract()).toStrictEqual({});
});

test("hydrates prefetch query with network-only fetch policy", async () => {
  stubOpenAiGlobals({ toolInput: {} });
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

  const execute = vi.fn();
  host.mockToolCall("execute", execute);

  host.sendToolResult({
    structuredContent: {
      prefetch: { __anonymous: { data } },
    },
  });
  host.sendToolInput({ arguments: {} });

  await client.connect();

  await expect(
    client.query({ query, fetchPolicy: "network-only" })
  ).resolves.toStrictEqual({ data });
  expect(execute).not.toHaveBeenCalled();
});

test("serves hydrated query from tool result while other network-only queries call execute", async () => {
  stubOpenAiGlobals({ toolInput: { id: "1" } });
  using _ = spyOnConsole("debug");

  const productQuery = gql`
    query Product($id: ID!)
    @tool(name: "GetProduct", description: "Get a product") {
      product(id: $id) {
        id
        title
        __typename
      }
    }
  `;

  const cartQuery = gql`
    query Cart @tool(name: "GetCart", description: "Get the cart") {
      cart {
        id
        __typename
      }
    }
  `;

  const productOperation = parseManifestOperation(productQuery);
  const cartOperation = parseManifestOperation(cartQuery);

  const client = new ApolloClient({
    cache: new InMemoryCache(),
    manifest: mockApplicationManifest({
      operations: [productOperation, cartOperation],
    }),
  });

  using host = await mockMcpHost({
    hostContext: minimalHostContextWithToolName("GetProduct"),
  });
  host.onCleanup(() => client.stop());

  const execute = vi.fn(() => ({
    structuredContent: {
      data: { cart: { id: "1", __typename: "Cart" } },
    },
  }));
  host.mockToolCall("execute", execute);

  host.sendToolResult({
    structuredContent: {
      result: {
        data: { product: { id: "1", title: "Pen", __typename: "Product" } },
      },
    },
  });
  host.sendToolInput({ arguments: { id: "1" } });

  await client.connect();

  const [productResult, cartResult] = await Promise.all([
    client.query({
      query: productQuery,
      variables: { id: "1" },
      fetchPolicy: "network-only",
    }),
    client.query({
      query: cartQuery,
      fetchPolicy: "network-only",
    }),
  ]);

  expect(productResult).toStrictEqual({
    data: { product: { id: "1", title: "Pen", __typename: "Product" } },
  });
  expect(cartResult).toStrictEqual({
    data: { cart: { id: "1", __typename: "Cart" } },
  });
  expect(execute).toHaveBeenCalledOnce();
});

test("serves hydrated query after tool result while earlier-queued non-matching query calls execute", async () => {
  stubOpenAiGlobals({ toolInput: { id: "1" } });
  using _ = spyOnConsole("debug");

  const productQuery = gql`
    query Product($id: ID!)
    @tool(name: "GetProduct", description: "Get a product") {
      product(id: $id) {
        id
        title
        __typename
      }
    }
  `;

  const cartQuery = gql`
    query Cart @tool(name: "GetCart", description: "Get the cart") {
      cart {
        id
        __typename
      }
    }
  `;

  const productOperation = parseManifestOperation(productQuery);
  const cartOperation = parseManifestOperation(cartQuery);

  const client = new ApolloClient({
    cache: new InMemoryCache(),
    manifest: mockApplicationManifest({
      operations: [productOperation, cartOperation],
    }),
  });

  using host = await mockMcpHost({
    hostContext: minimalHostContextWithToolName("GetProduct"),
  });
  host.onCleanup(() => client.stop());

  const execute = vi.fn(() => ({
    structuredContent: {
      data: { cart: { id: "1", __typename: "Cart" } },
    },
  }));
  host.mockToolCall("execute", execute);

  const connectPromise = client.connect();

  const cartPromise = client.query({
    query: cartQuery,
    fetchPolicy: "network-only",
  });

  host.sendToolResult({
    structuredContent: {
      result: {
        data: { product: { id: "1", title: "Pen", __typename: "Product" } },
      },
    },
  });
  host.sendToolInput({ arguments: { id: "1" } });

  await connectPromise;

  await expect(cartPromise).resolves.toStrictEqual({
    data: { cart: { id: "1", __typename: "Cart" } },
  });

  await expect(
    client.query({
      query: productQuery,
      variables: { id: "1" },
      fetchPolicy: "network-only",
    })
  ).resolves.toStrictEqual({
    data: { product: { id: "1", title: "Pen", __typename: "Product" } },
  });

  expect(execute).toHaveBeenCalledOnce();
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
    stubOpenAiGlobals({ toolInput });
    const client = new ApolloClient({
      cache: new InMemoryCache(),
      manifest: mockApplicationManifest(),
    });
    using host = await mockMcpHost({
      hostContext: minimalHostContextWithToolName("GetProductsByCategory"),
    });
    host.onCleanup(() => client.stop());
    host.sendToolResult(graphqlToolResult({ data: { products: [] } }));
    host.sendToolInput({
      arguments: toolInput,
    });
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
