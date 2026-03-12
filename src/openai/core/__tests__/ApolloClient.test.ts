import { expect, test, describe, vi } from "vitest";
import { ApolloClient } from "../ApolloClient.js";
import { parse } from "graphql";
import { ApolloLink, HttpLink, InMemoryCache, gql } from "@apollo/client";
import { ToolCallLink } from "../../link/ToolCallLink.js";
import {
  graphqlToolResult,
  minimalHostContextWithToolName,
  mockApplicationManifest,
  mockMcpHost,
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
