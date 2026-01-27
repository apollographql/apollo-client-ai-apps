import { expect, test } from "vitest";
import { ApolloProvider } from "../ApolloProvider.js";
import { render, waitFor } from "@testing-library/react";
import { ApolloClient } from "../../openai/core/ApolloClient.js";
import { SET_GLOBALS_EVENT_TYPE } from "../../openai/types.js";
import { gql, InMemoryCache } from "@apollo/client";
import { print } from "@apollo/client/utilities";
import {
  mockApplicationManifest,
  stubOpenAiGlobals,
  wait,
} from "../../testing/internal/index.js";

test("writes data to the cache when immediately available", async () => {
  const query = gql`
    query GreetingQuery {
      greeting
    }
  `;
  const data = {
    greeting: "hello",
  };
  stubOpenAiGlobals({
    toolOutput: {
      prefetch: {
        __anonymous: { data },
      },
    },
  });

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

  render(<ApolloProvider client={client} />);

  await wait(0);

  expect(client.extract()).toEqual({
    ROOT_QUERY: {
      __typename: "Query",
      greeting: "hello",
    },
  });
});

test("writes to the cache as soon as toolOutput is available", async () => {
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

  render(<ApolloProvider client={client} />);

  await expect(
    waitFor(() => expect(client.extract()).not.toEqual({}))
  ).rejects.toThrow();

  window.dispatchEvent(
    new CustomEvent(SET_GLOBALS_EVENT_TYPE, {
      detail: {
        globals: {
          toolOutput: {
            prefetch: {
              __anonymous: { data },
            },
          },
        },
      },
    })
  );

  await wait(0);

  expect(client.extract()).toEqual({
    ROOT_QUERY: {
      __typename: "Query",
      greeting: "hello",
    },
  });
});
