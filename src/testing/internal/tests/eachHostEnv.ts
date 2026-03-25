import { describe } from "vitest";
import { createHostEnv } from "../utilities/createHostEnv";
import { AbstractApolloClient } from "../../../core/AbstractApolloClient";
import { ApolloClient as McpApolloClient } from "../../../mcp/core/ApolloClient.js";
import { ApolloClient as OpenAiApolloClient } from "../../../openai/core/ApolloClient.js";

export function eachHostEnv(
  suite: (
    setupHost: ReturnType<typeof createHostEnv>,
    ApolloClient: new (
      options: AbstractApolloClient.Options
    ) => AbstractApolloClient
  ) => void | PromiseLike<void>
) {
  describe.each([
    ["mcp", McpApolloClient],
    ["openai", OpenAiApolloClient],
  ] as const)("Host: %s", (hostEnv, ApolloClient) => {
    return suite(createHostEnv(hostEnv), ApolloClient);
  });
}
