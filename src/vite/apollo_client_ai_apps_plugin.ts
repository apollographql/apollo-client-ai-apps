import { invariant } from "@apollo/client/utilities/invariant";
import type { Plugin } from "vite";

export interface ApolloAppsPluginOptions {
  target: "openai" | "mcp";
}

export function ApolloClientAiApps(options: ApolloAppsPluginOptions) {
  const { target } = options;

  invariant(
    target === "openai" || target === "mcp",
    "The `target` option must be one of 'openai' or 'mcp'"
  );

  return {
    name: "apollo-client-ai-apps",
    config() {
      const extensions = [
        ".mjs",
        ".js",
        ".mts",
        ".ts",
        ".jsx",
        ".tsx",
        ".json",
      ].flatMap((ext) => [`.${target}${ext}`, ext]);

      return {
        resolve: {
          extensions,
          conditions: [target],
        },
      };
    },
  } satisfies Plugin;
}
