---
default: major
---

# Updates `openai` related exports to work the the MCP Apps host bridge

Uses the MCP Apps host bridge to communicate with the OpenAI host, falling back to `window.openai` where necessary.

This change affects both the `useToolName` and `useToolResponseMetadata` hooks exported in `@apollo/client-ai-apps/openai` which now require the use of the `client` in the `ApolloProvider` context.
