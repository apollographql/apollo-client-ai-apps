---
default: minor
---

# Add type-safe tool names

The Vite plugin now generates a `.apollo-client-ai-apps/types/register.d.ts` TypeScript declaration file. This file contains a union of all tool names found in your app's `@tool` directives.

This means the `useToolName()` hook now provides the precise union of tool names instead of `string | undefined`:

```typescript
// before
const toolName = useToolName(); // string | undefined

// after (with @tool directives on "CreateTodo", "DeleteTodo", "UpdateTodo")
const toolName = useToolName(); // "CreateTodo" | "DeleteTodo" | "UpdateTodo" | undefined
```

The generated file is written to `.apollo-client-ai-apps/types/register.d.ts` and is kept up to date as you edit your operations. Add this path to your `tsconfig.json` `include` to ensure these types are included:

```json
{
  "include": ["src", ".apollo-client-ai-apps/types"]
}
```

You might also consider adding `.apollo-client-ai-apps/` to your `.gitignore` since it is fully generated.

The `ToolName` type is exported from `@apollo/client-ai-apps` if you need access to the available tool names for your own utilities.
