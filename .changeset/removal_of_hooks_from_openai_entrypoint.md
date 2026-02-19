---
default: major
---

# Removal of hooks from `/openai` entrypoint

The following hooks have been removed from `@apollo/client-ai-apps/openai`.

**`useOpenAiGlobal`**

This hook is now an internal-only hook. If you use `window.openai` directly and
need to listen for changes to properties, setup an event listener to listen for
changes to global values.

**`useSendFollowupMessage`**

Use the `App` instance returned by `useApp()` to send followup messages.

```diff
import {
- useSendFollowupMessage,
+ useApp
} from "@apollo/client-ai-apps/openai";

function MyComponent() {
- const sendFollowupMessage = useSendFollowupMessage();
+ const app = useApp();

  function sendMessage() {
-   sendFollowupMessage({ prompt: "..." });
+   app.sendMessage({
+     role: "user",
+     content: [{ type: "text", text: "..." }]
+   });
  }
}
```

**`useRequestDisplayMode`**

Use the `App` instance returned by `useApp()` to request changes to display mode.

```diff
import {
- useRequestDisplayMode,
+ useApp
} from "@apollo/client-ai-apps/openai";

function MyComponent() {
- const requestDisplayMode = useRequestDisplayMode();
+ const app = useApp();

  function changeDisplayMode() {
-   requestDisplayMode({ mode: "fullscreen" });
+   app.requestDisplayMode({ mode: "fullscreen" });
  }
}
```

**`useOpenExternal`**

Use the `App` instance returned by `useApp()` to open external links.

```diff
import {
- useOpenExternal,
+ useApp
} from "@apollo/client-ai-apps/openai";

function MyComponent() {
- const openLink = useOpenExternal();
+ const app = useApp();

  function changeDisplayMode() {
-   openLink({ href: "https://example.com" });
+   app.openLink({ url: "https://example.com" });
  }
}
```

**`useCallTool`**

Use the `App` instance returned by `useApp()` to call tools directly.

```diff
import {
- useCallTool,
+ useApp
} from "@apollo/client-ai-apps/openai";

function MyComponent() {
- const callTool = useCallTool();
+ const app = useApp();

  async function changeDisplayMode() {
-   await callTool("...", params)
+   app.callServerTool({ name: "...", arguments: params });
  }
}
```

**`useToolOutput`**

Apollo Client uses the tool output to populate the cache. Use the `data` property returned from Apollo Client query hooks instead `useToolOutput`.

## Rename of `useToolResponseMetadata`

To better align with the equivalent MCP app hook, `useToolResponseMetadata` has been renamed to `useToolMetadata` and now requires `ApolloClient` in React context to function.
