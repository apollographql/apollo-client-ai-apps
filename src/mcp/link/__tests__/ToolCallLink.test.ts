import { expect, test } from "vitest";
import { gql, InMemoryCache } from "@apollo/client";
import { execute } from "@apollo/client/link";
import { ApolloClient } from "../../core/ApolloClient.js";
import {
  mockApplicationManifest,
  mockMcpHost,
  ObservableStream,
  spyOnConsole,
} from "../../../testing/internal/index.js";
import { ToolCallLink } from "../ToolCallLink.js";

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

  using host = await mockMcpHost();
  host.onCleanup(() => client.stop());

  host.sendToolResult({
    _meta: { toolName: "GetProduct" },
    content: [],
    structuredContent: {},
  });
  host.sendToolInput({ arguments: {} });

  host.mockToolCall("execute", () => ({
    content: [],
    structuredContent: {
      data: { greeting: "Hello, world" },
    },
  }));

  await client.waitForInitialization();

  const observable = execute(new ToolCallLink(), { query }, { client });
  const stream = new ObservableStream(observable);

  await expect(stream).toEmitValue({
    data: { greeting: "Hello, world" },
  });

  await expect(stream).toComplete();
});
