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
  parseManifestOperation,
  renderAsync,
  spyOnConsole,
  stubOpenAiGlobals,
} from "../../../testing/internal/index.js";

test("writes prefetch data to the cache when immediately available", async () => {
  stubOpenAiGlobals();
  using _ = spyOnConsole("debug");

  const query = gql`
    query GreetingQuery @tool(description: "Fetches a greeting") @prefetch {
      greeting
    }
  `;

  const data = {
    greeting: "hello",
  };

  const client = new ApolloClient({
    cache: new InMemoryCache(),
    manifest: mockApplicationManifest({
      operations: [parseManifestOperation(query)],
    }),
  });

  using host = await mockMcpHost({
    hostContext: minimalHostContextWithToolName("GreetingQuery"),
  });
  host.onCleanup(() => client.stop());

  host.sendToolInput({ arguments: {} });
  host.sendToolResult({
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

test("hydrates the tool result and writes to the cache when query first executes", async () => {
  stubOpenAiGlobals();
  using _ = spyOnConsole("debug");

  const query = gql`
    query GreetingQuery @tool(description: "Fetches a greeting") {
      greeting
    }
  `;

  const client = new ApolloClient({
    cache: new InMemoryCache(),
    manifest: mockApplicationManifest({
      operations: [parseManifestOperation(query)],
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
    structuredContent: { result: { data: { greeting: "hello" } } },
  });

  await expect(
    waitFor(() => expect(client.extract()).not.toEqual({}))
  ).rejects.toThrow();

  await expect(client.query({ query })).resolves.toStrictEqual({
    data: { greeting: "hello" },
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
