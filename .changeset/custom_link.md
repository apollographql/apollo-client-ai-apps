---
default: minor
---

Allow the use of custom link chains with the `ApolloClient` constructor. A new `ToolCallLink` is now exported to allow for composition of custom link chains with the terminating link.

`ApolloClient` will now validate that the terminating link is a `ToolCallLink`.
