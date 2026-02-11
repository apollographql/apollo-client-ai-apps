---
default: major
---

# Introduce compatibility with MCP Apps

This change introduces compatibility with the [MCP Apps specification](https://github.com/modelcontextprotocol/ext-apps/blob/a815f31392555b1434ebf9a65a15dd4a7bde3fd6/specification/draft/apps.mdx). As a result, it is now possible to build your apps targeting both ChatGPT apps and MCP Apps.

## Vite plugin

A new `apolloClientAiApps` combines existing plugins (`ApplicationManifestPlugin` and `AbsoluteAssetImportsPlugin`) into a single plugin. It requires a `targets` option specifying which platforms to build for, and an optional `devTarget` for development mode when using multiple targets.

```ts
import { apolloClientAiApps } from "@apollo/client-ai-apps/vite";

export default defineConfig({
  plugins: [
    apolloClientAiApps({
      targets: ["openai", "mcp"],
      devTarget: "openai",
    }),
  ],
});
```

When building, the plugin produces separate outputs per target.

## Conditional exports

Platform-specific code is now gated behind [conditional exports](https://nodejs.org/api/packages.html#conditional-exports) to reduce the possibility for error when building for a specific platform. As such, two new platform-specific entrypoints are now available:

- `@apollo/client-ai-apps/mcp`
- `@apollo/client-ai-apps/openai`

Any available root-level exports that contain platform-specific code (e.g. `ApolloClient`, `ToolCallLink`) are provided behind conditional exports to ensure the right implementation is selected at build.

## New optional peer dependency

`@modelcontextprotocol/ext-apps` (^0.4.0) is now an optional peer dependency. This is required when you choose to build MCP apps.

## Extendable TypeScript configs

Extendable TypeScript configurations are now available for each platform:

- `@apollo/client-ai-apps/tsconfig/core`
- `@apollo/client-ai-apps/tsconfig/mcp`
- `@apollo/client-ai-apps/tsconfig/openai`

## Breaking changes

### OpenAI hooks and types removed from root export

All OpenAI-specific hooks and types have been removed from the root `@apollo/client-ai-apps` entrypoint. Import them from `@apollo/client-ai-apps/openai` instead.

```diff
- import { useToolName, useToolInput, useToolOutput } from "@apollo/client-ai-apps";
+ import { useToolName, useToolInput, useToolOutput } from "@apollo/client-ai-apps/openai";
```

### ApolloProvider is now Suspense-based

`ApolloProvider` now uses React Suspense to await client initialization. Wrap `ApolloProvider` in a `Suspense` component to show a loading state while the client is initializing.

```tsx
import { Suspense } from "react";
import { ApolloProvider } from "@apollo/client-ai-apps";

render(
  <Suspense fallback={<Spinner />}>
    <ApolloProvider client={client}>
      <App />
    <ApolloProvider />
  </Suspense>
);
```
