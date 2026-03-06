---
default: minor
---

# Add support for `extraOutputs` to the `@tool` directive

The `@tool` directive now supports an `extraOutputs` argument. This is a free-form object (any shape) that is written to the manifest under each tool's config.

```graphql
query MyQuery
@tool(name: "my-tool", description: "My tool", extraOutputs: { foo: "bar" }) {
  myField
}
```
