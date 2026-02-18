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

export { Platform } from "./core/Platform.js";

export const useApp =
  missingHook<typeof import("./mcp/react/hooks/useApp.js").useApp>("useApp");

export const useToolInput =
  missingHook<typeof import("./mcp/react/hooks/useToolInput.js").useToolInput>(
    "useToolInput"
  );

export const useToolMetadata =
  missingHook<
    typeof import("./mcp/react/hooks/useToolMetadata.js").useToolMetadata
  >("useToolMetadata");

export const useToolName =
  missingHook<typeof import("./mcp/react/hooks/useToolName.js").useToolName>(
    "useToolName"
  );
