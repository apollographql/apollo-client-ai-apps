import { expect, test } from "vitest";
import { Suspense } from "react";
import { ApolloProvider } from "../../ApolloProvider.js";
import { waitFor } from "@testing-library/react";
import { ApolloClient } from "../../../mcp/core/ApolloClient.js";
import { gql, InMemoryCache } from "@apollo/client";
import { print } from "@apollo/client/utilities";
import {
  minimalHostContextWithToolName,
  mockApplicationManifest,
  mockMcpHost,
  renderAsync,
  spyOnConsole,
} from "../../../testing/internal/index.js";

test("writes to the cache as soon as toolOutput is available", async () => {
  using _ = spyOnConsole("debug");

  const toolName = "GreetingQuery";
  using host = await mockMcpHost({
    hostContext: minimalHostContextWithToolName(toolName),
  });
  host.onCleanup(() => client.stop());

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

  host.sendToolInput({ arguments: {} });
  host.sendToolResult({
    content: [{ type: "text", text: JSON.stringify({ result: { data } }) }],
    structuredContent: { result: { data } },
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
