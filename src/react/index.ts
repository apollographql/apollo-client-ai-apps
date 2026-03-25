import { missingHook } from "./missingHook.js";

export { ApolloProvider } from "./ApolloProvider.js";
export { reactive } from "./reactive.js";
export type { Reactive } from "./reactive.js";

export { useApp } from "./hooks/useApp.js";
export { useHostContext } from "./hooks/useHostContext.js";

// Use `mcp` related types since these are the most common between the two
// targets

/**
 * @deprecated Please use the `useToolInfo` hook. `useToolInput` will be removed
 * in the next major version.
 */
export const useToolInput =
  missingHook<typeof import("./index.mcp.js").useToolInput>("useToolInput");

export const useToolMetadata =
  missingHook<typeof import("./index.mcp.js").useToolMetadata>(
    "useToolMetadata"
  );

/**
 * @deprecated Please use the `useToolInfo` hook. `useToolName` will be removed
 * in the next major version.
 */
export const useToolName =
  missingHook<typeof import("./index.mcp.js").useToolName>("useToolName");

export const useToolInfo =
  missingHook<typeof import("./index.mcp.js").useToolInfo>("useToolInfo");

/** @experimental */
export const createHydrationUtils = missingHook<
  typeof import("./index.mcp.js").createHydrationUtils
>("createHydrationUtils");
