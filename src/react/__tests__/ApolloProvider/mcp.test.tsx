import { expect, test } from "vitest";
import { Suspense } from "react";
import { ApolloProvider } from "../../ApolloProvider.js";
import { waitFor } from "@testing-library/react";
import { ApolloClient } from "../../../mcp/core/ApolloClient.js";
import { gql, InMemoryCache } from "@apollo/client";
import {
  minimalHostContextWithToolName,
  mockApplicationManifest,
  mockMcpHost,
  parseManifestOperation,
  renderAsync,
  spyOnConsole,
} from "../../../testing/internal/index.js";

test("hydrates the tool result and writes the cache when first queried", async () => {
  using _ = spyOnConsole("debug");

  const toolName = "GreetingQuery";
  using host = await mockMcpHost({
    hostContext: minimalHostContextWithToolName(toolName),
  });
  host.onCleanup(() => client.stop());

  const query = gql`
    query GreetingQuery @tool(description: "Fetches a greeting") {
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

  await renderAsync(<ApolloProvider client={client} />, {
    wrapper: ({ children }) => <Suspense>{children}</Suspense>,
  });

  await expect(
    waitFor(() => expect(client.extract()).not.toEqual({}))
  ).rejects.toThrow();

  host.sendToolInput({ arguments: {} });
  host.sendToolResult({
    structuredContent: { result: { data } },
  });

  await expect(
    waitFor(() => expect(client.extract()).not.toEqual({}))
  ).rejects.toThrow();

  await expect(client.query({ query })).resolves.toStrictEqual({
    data: { greeting: "hello" },
  });

  expect(client.extract()).toStrictEqual({
    ROOT_QUERY: {
      __typename: "Query",
      greeting: "hello",
    },
  });
});
