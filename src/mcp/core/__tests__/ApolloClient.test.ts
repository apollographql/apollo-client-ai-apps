import { expect, test, vi } from "vitest";
import { ApolloClient } from "../ApolloClient.js";
import { ApolloLink, HttpLink, InMemoryCache, gql } from "@apollo/client";
import { print } from "@apollo/client/utilities";
import { ToolCallLink } from "../../link/ToolCallLink.js";
import {
  mockApplicationManifest,
  mockMcpHost,
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

  using host = await mockMcpHost();
  host.onCleanup(() => client.stop());

  host.sendToolResult({
    _meta: { toolName: "GetProduct" },
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

  await client.waitForInitialization();

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

  using host = await mockMcpHost();
  host.onCleanup(() => client.stop());

  host.sendToolResult({
    _meta: { toolName: "OtherTool" },
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

  await client.waitForInitialization();

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

  using host = await mockMcpHost();
  host.onCleanup(() => client.stop());

  host.sendToolResult({
    _meta: { toolName: "Product" },
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

  await client.waitForInitialization();

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

  using host = await mockMcpHost();
  host.onCleanup(() => client.stop());

  host.sendToolResult({
    _meta: { toolName: "GetProduct" },
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

  await client.waitForInitialization();

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

  using host = await mockMcpHost();
  host.onCleanup(() => client.stop());

  host.sendToolResult({
    _meta: { toolName: "GetProduct" },
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

  await client.waitForInitialization();

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
