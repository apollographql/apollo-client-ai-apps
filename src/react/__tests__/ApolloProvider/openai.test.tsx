import { expect, test } from "vitest";
import { Suspense } from "react";
import { ApolloProvider } from "../../ApolloProvider.js";
import { waitFor } from "@testing-library/react";
import { ApolloClient } from "../../../openai/core/ApolloClient.js";
import { gql, InMemoryCache } from "@apollo/client";
import { print } from "@apollo/client/utilities";
import {
  minimalHostContextWithToolName,
  mockApplicationManifest,
  mockMcpHost,
  renderAsync,
  spyOnConsole,
  stubOpenAiGlobals,
} from "../../../testing/internal/index.js";

test("writes data to the cache when immediately available", async () => {
  stubOpenAiGlobals();
  using _ = spyOnConsole("debug");

  const query = gql`
    query GreetingQuery {
      greeting
    }
  `;

  const data = {
    greeting: "hello",
  };

  const client = new ApolloClient({
    cache: new InMemoryCache(),
    manifest: mockApplicationManifest({
      operations: [
        {
          id: "1",
          name: "GreetingQuery",
          body: print(query),
          prefetch: true,
          prefetchID: "__anonymous",
          type: "query",
          variables: {},
          tools: [],
        },
      ],
    }),
  });

  using host = await mockMcpHost({
    hostContext: minimalHostContextWithToolName("GreetingQuery"),
  });
  host.onCleanup(() => client.stop());

  host.sendToolInput({ arguments: {} });
  host.sendToolResult({
    content: [],
    structuredContent: {
      result: {
        data: null,
      },
      prefetch: {
        __anonymous: { data },
      },
    },
  });

  await renderAsync(<ApolloProvider client={client} />, {
    wrapper: ({ children }) => <Suspense>{children}</Suspense>,
  });

  await waitFor(() => {
    expect(client.extract()).toEqual({
      ROOT_QUERY: {
        __typename: "Query",
        greeting: "hello",
      },
    });
  });
});

test("writes to the cache as soon as toolOutput is available", async () => {
  stubOpenAiGlobals();
  using _ = spyOnConsole("debug");

  stubOpenAiGlobals();

  const query = gql`
    query GreetingQuery {
      greeting
    }
  `;
  const data = {
    greeting: "hello",
  };

  const client = new ApolloClient({
    cache: new InMemoryCache(),
    manifest: mockApplicationManifest({
      operations: [
        {
          id: "1",
          name: "GreetingQuery",
          body: print(query),
          prefetch: true,
          prefetchID: "__anonymous",
          type: "query",
          variables: {},
          tools: [],
        },
      ],
    }),
  });

  using host = await mockMcpHost({
    hostContext: minimalHostContextWithToolName("GreetingQuery"),
  });

  host.onCleanup(() => client.stop());
  host.sendToolInput({ arguments: {} });

  await renderAsync(<ApolloProvider client={client} />, {
    wrapper: ({ children }) => <Suspense>{children}</Suspense>,
  });

  await expect(
    waitFor(() => expect(client.extract()).not.toEqual({}))
  ).rejects.toThrow();

  host.sendToolResult({
    content: [],
    structuredContent: {
      prefetch: {
        __anonymous: { data },
      },
    },
  });

  await waitFor(() => {
    expect(client.extract()).toEqual({
      ROOT_QUERY: {
        __typename: "Query",
        greeting: "hello",
      },
    });
  });
});
