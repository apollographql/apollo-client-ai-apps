import { missingHook } from "./missingHook.js";

export { ApolloProvider } from "./ApolloProvider.js";
export { reactive } from "./reactive.js";
export type { Reactive } from "./reactive.js";

// Use `mcp` related types since these are the most common between the two
// targets
export const useApp =
  missingHook<typeof import("./index.mcp.js").useApp>("useApp");

export const useToolInput =
  missingHook<typeof import("./index.mcp.js").useToolInput>("useToolInput");

export const useToolMetadata =
  missingHook<typeof import("./index.mcp.js").useToolMetadata>(
    "useToolMetadata"
  );

export const useToolName =
  missingHook<typeof import("./index.mcp.js").useToolName>("useToolName");

/** @experimental */
export const createHydratedVariables = missingHook<
  typeof import("./index.mcp.js").createHydratedVariables
>("createHydratedVariables");
