---
default: patch
---

# Fix issue with operation description on executed queries

Fixes an issue where a query executed by the client through the Apollo MCP Server `execute` tool maintained operation descriptions on the query.
