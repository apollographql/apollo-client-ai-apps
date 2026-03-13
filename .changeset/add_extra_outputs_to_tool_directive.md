---
default: minor
---

# Add support for `extraOutputs` to the `@tool` directive

The `@tool` directive now supports an `extraOutputs` argument. This is a free-form object (any shape) that is written to the manifest under each tool's config. Values provided to `extraOutputs` are returned by Apollo MCP Server for the tool result in `structuredContent` to make it accessible to the LLM.

```graphql
query MyQuery
@tool(
  name: "my-tool",
  description: "My tool",
  extraOutputs: { "follow-up-instructions": "Perform a feat of magic" }
) {
  myField
}
```
