---
default: patch
---

# Hydrate `network-only`, `cache-and-network`, and `no-cache` queries from tool result data

Queries using `network-only`, `cache-and-network`, or `no-cache` fetch policies previously called the `execute` tool to fetch data, even when the result was already available from the tool call that initiated the app. These queries are now served directly from the tool result on first load, avoiding a redundant `execute` call. Subsequent queries will continue to call `execute` using the configured fetch policy as expected.
