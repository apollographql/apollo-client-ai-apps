---
default: minor
---

# Support @private in operations to hide parts of a query result from LLMs

In MCP Apps, you may have data that you want made available to your app but hidden from the LLM.

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
