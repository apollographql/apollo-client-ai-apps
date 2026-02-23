---
default: patch
---

# Add fallback when `toolName` is not available from host context

Provides a fallback in MCP apps to get the executed tool name from `_meta.toolName` when the host does not provide `toolInfo` from host context, or `structuredContent.toolName` when the host does not forward `_meta` to the connected application.
