---
default: minor
---

# Support `@private` in operations to hide parts of a query result from LLMs

In MCP Apps, you may have data that you want made available to your app but hidden from the LLM. A new `@private` directive is now supported that hides these fields from LLMs:

```
query ProductsQuery {
  topProducts {
    sku
    title
    meta @private {
      createdAt
      barcode
    }
  }
}
```

`@private` directs Apollo MCP Server to remove those fields in `structuredContent` so that the field data is not available to the LLM. The full result is instead added to `_meta`. `@apollo/client-ai-apps` handles reading the query result from the proper location when `@private` is used.
