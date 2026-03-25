---
default: major
---

# Simplified React entry points

The React entry points have now been simplified to encourage the use of the shared `/react` entry point. This means all React symbols shared between the `@apollo/client-ai-apps/mcp/react` and `@apollo/client-ai-apps/openai/react` entry points are only available in `@apollo/client-ai-apps/react`.

As part of this consolidation, the `@apollo/client-ai-apps/mcp/react` entry point was removed because there were no unique symbols exported from this entry point. The `@apollo/client-ai-apps/openai/react` entry point now exports only the `useWidgetState` hook. All other symbols should be imported from `@apollo/client-ai-apps/react`.

If you are already importing React symbols from `@apollo/client-ai-apps/react`, you do not need to do anything.

If you are importing React symbols from platform-specific entry points, you will need to update your imports to use the top-level `/react` entry point.

```diff
- import {
-   useApp,
-   useHostContext,
-   useToolInfo,
-   createHydrationUtils
- } from "@apollo/client-ai-apps/mcp/react";
- import {
-   useApp,
-   useHostContext,
-   useToolInfo,
-   createHydrationUtils
- } from "@apollo/client-ai-apps/openai/react";
+ import {
+   useApp,
+   useHostContext,
+   useToolInfo,
+   createHydrationUtils
+ } from "@apollo/client-ai-apps/react";
```

