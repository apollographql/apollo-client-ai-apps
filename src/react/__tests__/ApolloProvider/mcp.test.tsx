import { expect, test, vi } from "vitest";
import { Suspense } from "react";
import { ApolloProvider } from "../../ApolloProvider.js";
import { waitFor } from "@testing-library/react";
import { ApolloClient } from "../../../mcp/core/ApolloClient.js";
import { gql, InMemoryCache } from "@apollo/client";
import { print } from "@apollo/client/utilities";
import {
  mockApplicationManifest,
  mockMcpHost,
  renderAsync,
} from "../../../testing/internal/index.js";

test("writes to the cache as soon as toolOutput is available", async () => {
  const spy = vi.spyOn(console, "debug").mockImplementation(() => {});

  using host = await mockMcpHost();
  host.onCleanup(() => client.stop());

  const query = gql`
    query GreetingQuery {
      greeting
    }
  `;
  const data = {
    greeting: "hello",
  };

  const toolName = "GreetingQuery";

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
          tools: [{ name: toolName, description: "Fetches a greeting" }],
        },
      ],
    }),
  });

  await renderAsync(<ApolloProvider client={client} />, {
    wrapper: ({ children }) => <Suspense>{children}</Suspense>,
  });

  await expect(
    waitFor(() => expect(client.extract()).not.toEqual({}))
  ).rejects.toThrow();

  host.sendToolResult({
    _meta: { toolName },
    content: [{ type: "text", text: JSON.stringify({ result: { data } }) }],
    structuredContent: { result: { data } },
  });
  host.sendToolInput({ arguments: {} });

  await waitFor(() => {
    expect(client.extract()).toEqual({
      ROOT_QUERY: {
        __typename: "Query",
        greeting: "hello",
      },
    });
  });

  spy.mockRestore();
});
