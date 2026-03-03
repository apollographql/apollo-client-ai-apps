---
default: minor
---

# Add a `useHostContext` hook

Adds a new `useHostContext` hook that returns the current host context from the MCP host.

```typescript
import { useHostContext } from "@apollo/client-ai-apps/react";

function MyComponent() {
  const hostContext = useHostContext();

  // ...
}
```
