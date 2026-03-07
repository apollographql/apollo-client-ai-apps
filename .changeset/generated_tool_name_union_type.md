---
default: minor
---

# Add type-safe tool names

The Vite plugin now generates a `src/apollo-ai-apps.d.ts` TypeScript declaration file. This file contains a union of all tool names found in your app's `@tool` directives.

This means the `useToolName()` hook now provides the precise union of tool names instead of `string | undefined`:

```typescript
// before
const toolName = useToolName(); // string | undefined

// after (with @tool directives on "CreateTodo", "DeleteTodo", "UpdateTodo")
const toolName = useToolName(); // "CreateTodo" | "DeleteTodo" | "UpdateTodo" | undefined
```

The generated file is written to `src/apollo-ai-apps.d.ts` by default and is kept up to date as you edit your operations. You can customize the output path via the `typesOutFile` plugin option:

```typescript
apolloClientAiApps({
  targets: ["mcp"],
  appsOutDir: "apps",
  typesOutFile: "src/apollo-ai-apps.d.ts", // default
});
```

If you place the file outside of your `tsconfig` `include` paths, add a triple-slash reference to include it:

```typescript
/// <reference path="../apollo-ai-apps.d.ts" />
```

The `ToolName` type is exported from `@apollo/client-ai-apps` if you need access to the available tool names for your own utilities.
