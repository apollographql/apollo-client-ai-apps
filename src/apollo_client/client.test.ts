import { expect, test, describe, vi } from "vitest";
import { ExtendedApolloClient } from "./client";
import { ApplicationManifest } from "../types/application-manifest";
import { parse } from "graphql";
import { InMemoryCache } from "@apollo/client";

describe("Client Basics", () => {
  test("Should execute tool call when client.query is called", async () => {
    vi.stubGlobal("openai", {
      toolInput: {},
      toolOutput: {},
      toolResponseMetadata: {
        toolName: "the-store--Get Product",
      },
      callTool: vi.fn(async (name: string, args: Record<string, unknown>) => {
        return {
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
        };
      }),
    });

    const manifest = {
      format: "apollo-ai-app-manifest",
      version: "1",
      name: "the-store",
      description:
        "An online store selling a variety of high quality products across many different categories.",
      hash: "f6a24922f6ad6ed8c2aa57baf3b8242ae5f38a09a6df3f2693077732434c4256",
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
              name: "Get Product",
              description: "Shows the details page for a specific product.",
            },
          ],
        },
      ],
      resource: "index.html",
    };

    const client = new ExtendedApolloClient({
      cache: new InMemoryCache(),
      manifest: manifest as ApplicationManifest,
    });

    const variables = { id: "1" };
    await client.query({
      query: parse(manifest.operations[0].body),
      variables,
    });

    expect(window.openai.callTool).toBeCalledWith("execute", {
      query: manifest.operations[0].body,
      variables,
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
  test("Should cache tool response when data is provided", async () => {
    vi.stubGlobal("openai", {
      toolInput: {
        id: 1,
      },
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
      toolResponseMetadata: {
        toolName: "the-store--Get Product",
      },
    });

    const manifest = {
      format: "apollo-ai-app-manifest",
      version: "1",
      name: "the-store",
      description:
        "An online store selling a variety of high quality products across many different categories.",
      hash: "f6a24922f6ad6ed8c2aa57baf3b8242ae5f38a09a6df3f2693077732434c4256",
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
              name: "Get Product",
              description: "Shows the details page for a specific product.",
            },
          ],
        },
      ],
      resource: "index.html",
    };

    const client = new ExtendedApolloClient({
      cache: new InMemoryCache(),
      manifest: manifest as ApplicationManifest,
    });
    await client.prefetchData();

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

  test("Should cache prefetched data when prefetched data is provided", async () => {
    vi.stubGlobal("openai", {
      toolInput: {},
      toolOutput: {
        result: {},
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
      toolResponseMetadata: {
        toolName: "the-store--Get Product",
      },
    });

    const manifest = {
      format: "apollo-ai-app-manifest",
      version: "1",
      name: "the-store",
      description:
        "An online store selling a variety of high quality products across many different categories.",
      hash: "f6a24922f6ad6ed8c2aa57baf3b8242ae5f38a09a6df3f2693077732434c4256",
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
              name: "Top Products",
              description: "Shows the currently highest rated products.",
            },
          ],
        },
      ],
      resource: "index.html",
    };

    const client = new ExtendedApolloClient({
      cache: new InMemoryCache(),
      manifest: manifest as ApplicationManifest,
    });
    await client.prefetchData();

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

  test("Should cache both prefetch and tool response when both are provided", async () => {
    vi.stubGlobal("openai", {
      toolInput: {
        id: 1,
      },
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
      toolResponseMetadata: {
        toolName: "the-store--Get Product",
      },
    });

    const manifest = {
      format: "apollo-ai-app-manifest",
      version: "1",
      name: "the-store",
      description:
        "An online store selling a variety of high quality products across many different categories.",
      hash: "f6a24922f6ad6ed8c2aa57baf3b8242ae5f38a09a6df3f2693077732434c4256",
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
              name: "Get Product",
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
              name: "Top Products",
              description: "Shows the currently highest rated products.",
            },
          ],
        },
      ],
      resource: "index.html",
    };

    const client = new ExtendedApolloClient({
      cache: new InMemoryCache(),
      manifest: manifest as ApplicationManifest,
    });
    await client.prefetchData();

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

  test("Should exclude extra inputs when writing to cache", async () => {
    vi.stubGlobal("openai", {
      toolInput: {
        id: 1,
        myOtherThing: 2,
      },
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
      toolResponseMetadata: {
        toolName: "the-store--Get Product",
      },
    });

    const manifest = {
      format: "apollo-ai-app-manifest",
      version: "1",
      name: "the-store",
      description:
        "An online store selling a variety of high quality products across many different categories.",
      hash: "f6a24922f6ad6ed8c2aa57baf3b8242ae5f38a09a6df3f2693077732434c4256",
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
              name: "Get Product",
              description: "Shows the details page for a specific product.",
            },
          ],
        },
      ],
      resource: "index.html",
    };

    const client = new ExtendedApolloClient({
      cache: new InMemoryCache(),
      manifest: manifest as ApplicationManifest,
    });
    await client.prefetchData();

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
