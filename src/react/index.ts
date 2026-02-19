import { missingHook } from "./missingHook.js";

export { ApolloProvider } from "./ApolloProvider.js";

// Use `mcp` related types since these are the most common between the two
// targets
export const useApp =
  missingHook<typeof import("../mcp/react/hooks/useApp.js").useApp>("useApp");

export const useToolInput =
  missingHook<typeof import("../mcp/react/hooks/useToolInput.js").useToolInput>(
    "useToolInput"
  );

export const useToolMetadata =
  missingHook<
    typeof import("../mcp/react/hooks/useToolMetadata.js").useToolMetadata
  >("useToolMetadata");

export const useToolName =
  missingHook<typeof import("../mcp/react/hooks/useToolName.js").useToolName>(
    "useToolName"
  );
