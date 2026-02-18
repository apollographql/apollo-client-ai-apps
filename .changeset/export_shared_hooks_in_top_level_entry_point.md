---
default: minor
---

# Export shared hooks in top-level entry point

Common hooks used in the `/openai` and `/mcp` entry points are now exported from the top-level entry point. These include the following:

- `useApp`
- `useToolInput`
- `useToolMetadata`
- `useToolName`
