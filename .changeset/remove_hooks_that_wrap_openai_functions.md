---
default: major
---

# Remove hooks that wrap openai functions

Hooks exported from `@apollo/client-ai-apps/openai` that were simple wrappers around functions defined in `window.openai` have been removed. Please use `window.openai` directly.

The following hooks have been removed:

- `useCallTool` - Use `window.openai.callTool`
- `useOpenExternal` - Use `window.openai.openExternal`
- `useRequestDisplayMode` - Use `window.openai.requestDisplayMode`
- `useSendFollowupMessage` - Use `window.openai.sendFollowupMessage`
