---
default: patch
---

# Honor no-cache queries when hydrating query

The `no-cache` fetch policy is now properly honored when hydrating a `no-cache` query initiated by a tool call. Previously, all tool calls wrote the query to the cache regardless of the configured fetch policy.
