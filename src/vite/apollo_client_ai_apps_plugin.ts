import { defaultClientConditions, type Plugin } from "vite";
import { invariant } from "@apollo/client/utilities/invariant";
import { ApplicationManifestPlugin } from "./application_manifest_plugin.js";
import { AbsoluteAssetImportsPlugin } from "./absolute_asset_imports_plugin.js";

export declare namespace ApolloClientAiAppsPlugin {
  export interface Options extends BaseApolloClientAiAppsPlugin.Options {}
}

export function ApolloClientAiAppsPlugin(
  options: ApolloClientAiAppsPlugin.Options
): Plugin[] {
  return [
    BaseApolloClientAiAppsPlugin(options),
    ApplicationManifestPlugin(),
    AbsoluteAssetImportsPlugin(),
  ];
}

export declare namespace BaseApolloClientAiAppsPlugin {
  export interface Options {
    target: "openai" | "mcp";
  }
}

export function BaseApolloClientAiAppsPlugin(
  options: BaseApolloClientAiAppsPlugin.Options
): Plugin {
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
          conditions: [target, ...defaultClientConditions],
        },
      };
    },
  } satisfies Plugin;
}
