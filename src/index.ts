export type {
  API,
  CallTool,
  DeviceType,
  DisplayMode,
  OpenAiGlobals,
  SafeArea,
  SafeAreaInsets,
  Theme,
  UserAgent,
  UnknownObject,
} from "./types/openai.js";
export { SET_GLOBALS_EVENT_TYPE, SetGlobalsEvent } from "./types/openai.js";

export type {
  ApplicationManifest,
  ManifestOperation,
  ManifestTool,
  ManifestExtraInput,
  ManifestCsp,
  ManifestLabels,
  ManifestWidgetSettings,
} from "./types/application-manifest.js";

export { ToolUseProvider } from "./react/context/ToolUseContext.js";
export { useOpenAiGlobal } from "./react/hooks/useOpenAiGlobal.js";
export { useToolName } from "./react/hooks/useToolName.js";
export { useToolInput } from "./react/hooks/useToolInput.js";
export { useSendFollowUpMessage } from "./react/hooks/useSendFollowUpMessage.js";
export { useRequestDisplayMode } from "./react/hooks/useRequestDisplayMode.js";
export { useToolEffect } from "./react/hooks/useToolEffect.js";
export { useOpenExternal } from "./react/hooks/useOpenExternal.js";
export { useToolOutput } from "./react/hooks/useToolOutput.js";
export { useToolResponseMetadata } from "./react/hooks/useToolResponseMetadata.js";
export { useWidgetState } from "./react/hooks/useWidgetState.js";

export { ApolloClient } from "./core/ApolloClient.js";
export { ApolloProvider } from "./react/ApolloProvider.js";
export { ToolCallLink } from "./link/ToolCallLink.js";
