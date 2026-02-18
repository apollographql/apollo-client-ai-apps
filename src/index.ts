import { missingHook } from "./react/missingHook.js";

export type {
  ApplicationManifest,
  ManifestOperation,
  ManifestTool,
  ManifestExtraInput,
  ManifestCsp,
  ManifestLabels,
  ManifestWidgetSettings,
} from "./types/application-manifest.js";

export { ApolloProvider, ToolUseProvider } from "./react/index.js";
export { ApolloClient } from "./core/ApolloClient.js";
export { ToolCallLink } from "./link/ToolCallLink.js";

export const useApp = missingHook("useApp");
export const useToolInput = missingHook("useToolInput");
export const useToolMetadata = missingHook("useToolMetadata");
export const useToolName = missingHook("useToolName");
