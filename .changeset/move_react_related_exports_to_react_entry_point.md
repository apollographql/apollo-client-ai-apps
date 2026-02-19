---
default: major
---

# Move React-related exports to `/react` entry point

Move all React-related exports to `/react` entry point. This ensures apps that built on top of the core APIs do not have to install and use the `react` package. In addition, platform-specific `/react` entry points have been added in order to use platform-specific hooks:

- `@apollo/client-ai-apps/react` - Shared React utilities for both platforms
- `@apollo/client-ai-apps/openai/react` - OpenAI specific React utilities
- `@apollo/client-ai-apps/mcp/react` - MCP Apps specific React utilities

This change means the `react` and `react-dom` packages are now marked as optional peer dependencies.
