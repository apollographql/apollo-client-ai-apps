---
default: patch
---

# Honor no-cache queries when hydrating query

Tool results are no longer written to the cache during initialization and will instead only write to the cache if the fetch policy is configured to write to the cache. This means queries configured as tools with a `no-cache` fetch policy is honored and no longer written to the cache.
