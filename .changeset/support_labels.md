---
default: minor
---

# Support `toolInvocation` labels

Add support for `labels` config for both `package.json` and `@tool` directives.

```ts
// package.json
{
  "labels": {
    "toolInvocation": {
      "invoking": "Invoking...",
      "invoked": "Invoked!"
    }
  }
}
```

```gql
query {
  MyQuery
    @tool(
      name: "MyQuery"
      description: "..."
      labels: {
        toolInvocation: { invoking: "Invoking...", invoked: "Invoked!" }
      }
    ) {
    myField
  }
}
```

These labels map to the following MCP server config:

- `toolInvocation.invoking` -> `toolInvocation/invoking`
- `toolInvocation.invoked` -> `toolInvocation/invoked`
