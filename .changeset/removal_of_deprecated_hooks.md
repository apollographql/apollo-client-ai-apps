---
default: major
---

# Remove deprecated hooks

The deprecated `useToolInput` and `useToolName` hooks have been removed along with their corresponding `ToolInput` and `ToolName` types. Use `useToolInfo` instead:

```diff
- import { useToolInput, useToolName } from "@apollo/client-ai-apps/react";
+ import { useToolInfo } from "@apollo/client-ai-apps/react";

  function MyComponent() {
-   const toolName = useToolName();
-   const toolInput = useToolInput();
+   const { toolName, toolInput } = useToolInfo();

    // ...
  }
```
