---
default: minor
---

# `@tool` `name` and `description` arguments are now optional

The `name` and `description` arguments on the `@tool` directive are now optional. When omitted, they fall back to the operation name and description respectively.

```graphql
# name defaults to "HelloWorldQuery", description defaults to the operation description
"""
Say hello to the world.
"""
query HelloWorldQuery @tool {
  helloWorld
}
```

Tool `name` and `description` are still enforced and must be set either by the operation or the `@tool` arguments. An anonymous operation or an operation that omits the description while using a bare `@tool` directive fails validation.

When an operation has multiple `@tool` directives, `name` and `description` must still be provided explicitly on each directive to avoid ambiguity.

```graphql
# ✅ Valid — each @tool has an explicit name and description
query ProductsQuery
@tool(name: "list-products", description: "List all products")
@tool(name: "search-products", description: "Search products by keyword") {
  products {
    id
    title
  }
}

# ❌ Error — missing name on second @tool when multiple are present
query ProductsQuery
@tool(name: "list-products", description: "List all products")
@tool(description: "Search products") {
  products {
    id
    title
  }
}
```
