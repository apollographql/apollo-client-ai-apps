## 0.5.1 (2026-02-19)

### Fixes

#### Fixes the type of `ApolloClientAiAppsConfig.Config`

The `ApolloClientAiAppsConfig.Config` is mistakenly set as the output type instead of the input type. This primarily affected the `labels` config which expected a different input shape than the output shape.

## 0.5.0 (2026-02-19)

### Breaking Changes

#### Introduce compatibility with MCP Apps

This change introduces compatibility with the [MCP Apps specification](https://github.com/modelcontextprotocol/ext-apps/blob/a815f31392555b1434ebf9a65a15dd4a7bde3fd6/specification/draft/apps.mdx). As a result, it is now possible to build your apps targeting both ChatGPT apps and MCP Apps.

### Vite plugin

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

### Conditional exports

Platform-specific code is now gated behind [conditional exports](https://nodejs.org/api/packages.html#conditional-exports) to reduce the possibility for error when building for a specific platform. As such, two new platform-specific entrypoints are now available:

- `@apollo/client-ai-apps/mcp`
- `@apollo/client-ai-apps/openai`

Any available root-level exports that contain platform-specific code (e.g. `ApolloClient`, `ToolCallLink`) are provided behind conditional exports to ensure the right implementation is selected at build.

### New optional peer dependency

`@modelcontextprotocol/ext-apps` (^0.4.0) is now an optional peer dependency. This is required when you choose to build MCP apps.

### Extendable TypeScript configs

Extendable TypeScript configurations are now available for each platform:

- `@apollo/client-ai-apps/tsconfig/core`
- `@apollo/client-ai-apps/tsconfig/mcp`
- `@apollo/client-ai-apps/tsconfig/openai`

### Breaking changes

#### OpenAI hooks and types removed from root export

All OpenAI-specific hooks and types have been removed from the root `@apollo/client-ai-apps` entrypoint. Import them from `@apollo/client-ai-apps/openai` instead.

```diff
- import { useToolName, useToolInput, useToolOutput } from "@apollo/client-ai-apps";
+ import { useToolName, useToolInput, useToolOutput } from "@apollo/client-ai-apps/openai";
```

#### ApolloProvider is now Suspense-based

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

#### Changes to vite plugins

The `ApplicationManifestPlugin` and `AbsoluteAssetImportsPlugin` have been combined with the `apolloClientAiApps` plugin and are no longer available as individual plugins. Please remove these plugins from your vite config and use the `apolloClientAiApps` plugin instead.

```diff
// vite.config.ts
import {
- ApplicationManifestPlugin,
- AbsoluteAssetImportsPlugin,
+ apolloClientAiApps
} from "@apollo/client-ai-apps/vite";

export default defineConfig({
  // ...
  plugins: [
-   ApplicationManifestPlugin(),
-   AbsoluteAssetImportsPlugin(),
+   apolloClientAiApps({ targets: [/* define targets here */] }),
  ],
});
```

#### Load configuration with cosmiconfig

Apps config is now loaded via [cosmiconfig](https://github.com/cosmiconfig/cosmiconfig). As a result, config defined in `package.json` MUST be defined under the `apollo-client-ai-apps` key.

```diff
// package.json
{
  // ...
- "csp": {
-   "connectDomains": ["https://example.com"]
- }
+ "apollo-client-ai-apps": {
+   "csp": {
+     "connectDomains": ["https://example.com"]
+   }
+ }
}
```

Configuration can be loaded from the following files:

- `.apollo-client-ai-apps.config.json`
- `apollo-client-ai-apps.config.json`
- `.apollo-client-ai-apps.config.yml`
- `apollo-client-ai-apps.config.yml`
- `.apollo-client-ai-apps.config.yaml`
- `apollo-client-ai-apps.config.yaml`
- `.apollo-client-ai-apps.config.js`
- `apollo-client-ai-apps.config.js`
- `.apollo-client-ai-apps.config.ts`
- `apollo-client-ai-apps.config.ts`
- `.apollo-client-ai-apps.config.cjs`
- `apollo-client-ai-apps.config.cjs`
- A `apollo-client-ai-apps` key in package.json

### Type-safe configuration

A `defineConfig` helper is now available to export type-safe configuration when using a `config.ts` file (recommended).

```ts
// apollo-client-ai-apps.config.ts
import { defineConfig } from "@apollo/client-ai-apps/config";

export default defineConfig({
  csp: {
    connectDomains: ["https://example.com"],
  },
});
```

Alternatively you may use the type directly:

```ts
// apollo-client-ai-apps.config.ts
import type { ApolloClientAiAppsConfig } from "@apollo/client-ai-apps/config";

const config: ApolloClientAiAppsConfig.Config = {
  csp: {
    connectDomains: ["https://example.com"],
  },
};

export default config;
```

#### Move React-related exports to `/react` entry point

Move all React-related exports to `/react` entry point. This ensures apps that built on top of the core APIs do not have to install and use the `react` package. In addition, platform-specific `/react` entry points have been added in order to use platform-specific hooks:

- `@apollo/client-ai-apps/react` - Shared React utilities for both platforms
- `@apollo/client-ai-apps/openai/react` - OpenAI specific React utilities
- `@apollo/client-ai-apps/mcp/react` - MCP Apps specific React utilities

This change means the `react` and `react-dom` packages are now marked as optional peer dependencies.

#### Removal of hooks from `/openai` entrypoint

The following hooks have been removed from `@apollo/client-ai-apps/openai`.

**`useOpenAiGlobal`**

This hook is now an internal-only hook. If you use `window.openai` directly and
need to listen for changes to properties, setup an event listener to listen for
changes to global values.

**`useSendFollowupMessage`**

Use the `App` instance returned by `useApp()` to send followup messages.

```diff
import {
- useSendFollowupMessage,
+ useApp
} from "@apollo/client-ai-apps/openai";

function MyComponent() {
- const sendFollowupMessage = useSendFollowupMessage();
+ const app = useApp();

  function sendMessage() {
-   sendFollowupMessage({ prompt: "..." });
+   app.sendMessage({
+     role: "user",
+     content: [{ type: "text", text: "..." }]
+   });
  }
}
```

**`useRequestDisplayMode`**

Use the `App` instance returned by `useApp()` to request changes to display mode.

```diff
import {
- useRequestDisplayMode,
+ useApp
} from "@apollo/client-ai-apps/openai";

function MyComponent() {
- const requestDisplayMode = useRequestDisplayMode();
+ const app = useApp();

  function changeDisplayMode() {
-   requestDisplayMode({ mode: "fullscreen" });
+   app.requestDisplayMode({ mode: "fullscreen" });
  }
}
```

**`useOpenExternal`**

Use the `App` instance returned by `useApp()` to open external links.

```diff
import {
- useOpenExternal,
+ useApp
} from "@apollo/client-ai-apps/openai";

function MyComponent() {
- const openLink = useOpenExternal();
+ const app = useApp();

  function changeDisplayMode() {
-   openLink({ href: "https://example.com" });
+   app.openLink({ url: "https://example.com" });
  }
}
```

**`useCallTool`**

Use the `App` instance returned by `useApp()` to call tools directly.

```diff
import {
- useCallTool,
+ useApp
} from "@apollo/client-ai-apps/openai";

function MyComponent() {
- const callTool = useCallTool();
+ const app = useApp();

  async function changeDisplayMode() {
-   await callTool("...", params)
+   app.callServerTool({ name: "...", arguments: params });
  }
}
```

**`useToolOutput`**

Apollo Client uses the tool output to populate the cache. Use the `data` property returned from Apollo Client query hooks instead `useToolOutput`.

### Rename of `useToolResponseMetadata`

To better align with the equivalent MCP app hook, `useToolResponseMetadata` has been renamed to `useToolMetadata` and now requires `ApolloClient` in React context to function.

#### Remove `useToolEffect` hook

Removes the `useToolEffect` hook from `@apollo/client-ai-apps/openai`. This change also removes `ToolUseProvider` as it is no longer used by any remaining hook.

#### Updates `openai` related exports to work the the MCP Apps host bridge

Uses the MCP Apps host bridge to communicate with the OpenAI host, falling back to `window.openai` where necessary.

This change affects both the `useToolName` and `useToolResponseMetadata` hooks exported in `@apollo/client-ai-apps/openai` which now require the use of the `client` in the `ApolloProvider` context.

### Features

#### Add a new `Platform` utility

Adds a new `Platform` utility that makes it easier to detect the current platform. Useful when needing to select a value based on the current platform in a shared component.

```tsx
import { Platform } from "@apollo/client-ai-apps";

// `Platform.target` returns the current target ("openai" or "mcp")
// `Platform.select` returns the value based on the current target. The value
// can by anything.
<div
  style={{
    border: Platform.select({ mcp: "1px solid red", openai: "1px solid blue" }),
  }}
>
  {Platform.target}
</div>;
```

#### Add a `useToolInput` hook for the `/mcp` entrypoint

Adds a `useToolInput` to get the tool input value.

#### App version now configured

The MCP app version is now configured in the manifest and is set by the version your `package.json` file.

#### Apps config now parsed with zod

The apps config and directive inputs are now parsed and validated with [`zod`](https://zod.dev/). Validation is now more strict and does not allow additional properties that don't exist in the validation schemas. Additionally, you may see a change in the format of the error message if a validation error occurs.

#### Export shared hooks in top-level entry point

Common hooks used in the `/openai` and `/mcp` entry points are now exported from the top-level entry point. These include the following:

- `useApp`
- `useToolInput`
- `useToolMetadata`
- `useToolName`

#### Support for platform-specific entry point config

You can now provide a custom entry for a specific target. In your `package.json`:

```json
{
  "entry": {
    "production": {
      "mcp": "https://mcp.example.com",
      "openai": "https://openai.example.com"
    }
  }
}
```

The MCP app version is now configured by the version your `package.json` file

### Fixes

#### Remove the app prefix when matching tool names.

The app prefix has been removed in tool names from the MCP server, so we no longer need to match against tool names with the app prefix.

## 0.4.0 (2026-01-15)

### Breaking Changes

#### Make `@apollo/client` a peer dependency

`@apollo/client` is now a peer dependency and must be installed along with this package.

`@apollo/client` exports have also been removed from this package and should be imported from `@apollo/client` instead.

```diff
- import { useQuery } from "@apollo/client-ai-apps";
+ import { useQuery } from "@apollo/client";
```

### Features

#### Support additional CSP settings

Add support for `frameDomains` and `redirectDomains` in CSP settings.

#### Support `toolInvocation` labels

Add support for `labels` config for both `package.json` and `@tool` directives.

```ts
// package.json
{
  "labels": {
    "toolInvocation": {
      "invoking": "Invoking...",
      "invoked": "Invoked!"
    }
  }
}
```

```gql
query {
  MyQuery
    @tool(
      name: "MyQuery"
      description: "..."
      labels: {
        toolInvocation: { invoking: "Invoking...", invoked: "Invoked!" }
      }
    ) {
    myField
  }
}
```

These labels map to the following MCP server config:

- `toolInvocation.invoking` -> `toolInvocation/invoking`
- `toolInvocation.invoked` -> `toolInvocation/invoked`

### Fixes

#### Updated `react` and `react-dom` peer dependency versions

The `react` and `react-dom` peer dependency versions have been loosened to `^19.0.0`.

## 0.3.3 (2026-01-13)

### Features

#### Add support for `widgetSettings` in the manifest file

This includes `widgetSettngs.prefersBorder`, `widgetSettings.description`, and `widgetSettings.domain`.

```json
// package.json
{
  // ...
  "widgetSettings": {
    "prefersBorder": true,
    "description": "Widget description",
    "domain": "https://example.com"
  }
}
```

These map to the OpenAI meta fields:

- `widgetSettings.description` -> `openai/widgetDescription`
- `widgetSettings.domain` -> `openai/widgetDomain`
- `widgetSettings.prefersBorder` -> `openai/widgetPrefersBorder,`
