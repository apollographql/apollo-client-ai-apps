---
default: patch
---

# Strip operation description from manifest `body` field

When a GraphQL operation uses an operation description as the tool description, the description is removed from the operation `body` in the manifest. This fixes a compatibility issue with Apollo MCP Server which currently does not support operation descriptions.
