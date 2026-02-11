---
default: major
---

# Introduce compatibility with MCP Apps

This change introduces compatibility with the [MCP Apps specification](https://github.com/modelcontextprotocol/ext-apps/blob/a815f31392555b1434ebf9a65a15dd4a7bde3fd6/specification/draft/apps.mdx). As a result, it is now possible to build your apps targeting both ChatGPT apps and MCP Apps. MCP App related utilities are available in the `@apollo/client-ai-apps/mcp` entrypoint.

## Changes to existing utilities

All existing ChatGPT utilities have been moved to the `@apollo/client-ai-apps/openai` entrypoint. These utilities are now guarded by an `openai` [conditional export](https://nodejs.org/api/packages.html#conditional-exports).
