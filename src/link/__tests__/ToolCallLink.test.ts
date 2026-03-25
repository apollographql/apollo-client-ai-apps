import { expect, test } from "vitest";
import { gql, InMemoryCache } from "@apollo/client";
import { execute } from "@apollo/client/link";
import {
  eachHostEnv,
  mockApplicationManifest,
  ObservableStream,
  spyOnConsole,
} from "../../testing/internal/index.js";
import { ToolCallLink } from "../ToolCallLink.js";

eachHostEnv((setupHost, ApolloClient) => {
  test("merges _meta.structuredContent into result for @private fields", async () => {
    using _ = spyOnConsole("debug");
    const query = gql`
      query GreetingQuery {
        greeting @private
      }
    `;

    const client = new ApolloClient({
      cache: new InMemoryCache(),
      manifest: mockApplicationManifest(),
    });

    const { host, params } = await setupHost({
      client,
      toolCall: {
        name: "GetProduct",
        result: { structuredContent: { result: { data: { product: null } } } },
      },
    });
    using _host = host;

    host.sendToolInput(params.toolInput);
    host.sendToolResult(params.toolResult);

    host.mockToolCall("execute", () => ({
      structuredContent: {},
      _meta: {
        structuredContent: { data: { greeting: "Hello, private world" } },
      },
    }));

    await client.connect();

    const observable = execute(new ToolCallLink(), { query }, { client });
    const stream = new ObservableStream(observable);

    await expect(stream).toEmitValue({
      data: { greeting: "Hello, private world" },
    });

    await expect(stream).toComplete();
  });

  test("delegates query execution to MCP host", async () => {
    using _ = spyOnConsole("debug");
    const query = gql`
      query GreetingQuery {
        greeting
      }
    `;

    const client = new ApolloClient({
      cache: new InMemoryCache(),
      manifest: mockApplicationManifest(),
    });

    const { host, params } = await setupHost({
      client,
      toolCall: {
        name: "GetProduct",
        result: { structuredContent: { result: { data: { product: null } } } },
      },
    });
    using _host = host;

    host.sendToolInput(params.toolInput);
    host.sendToolResult(params.toolResult);

    host.mockToolCall("execute", () => ({
      structuredContent: {
        data: { greeting: "Hello, world" },
      },
    }));

    await client.connect();

    const observable = execute(new ToolCallLink(), { query }, { client });
    const stream = new ObservableStream(observable);

    await expect(stream).toEmitValue({
      data: { greeting: "Hello, world" },
    });

    await expect(stream).toComplete();
  });
});
