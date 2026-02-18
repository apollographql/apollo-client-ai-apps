---
default: minor
---

# Add a new `Platform` utility

Adds a new `Platform` utility that makes it easier to detect the current platform. Useful when needing to select a value based on the current platform in a shared component.

```tsx
import { Platform } from "@apollo/client-ai-apps";

// `Platform.target` returns the current target ("openai" or "mcp")
// `Platform.select` returns the value based on the current target. The value
// can by anything.
<div
  style={{
    border: Platform.select({ mcp: "1px solid red", openai: "1px solid blue" }),
  }}
>
  {Platform.target}
</div>;
```
