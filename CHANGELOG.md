## 0.6.5 (2026-03-23)

### Features

#### Add support for `extraOutputs` to the `@tool` directive

The `@tool` directive now supports an `extraOutputs` argument. This is a free-form object (any shape) that is written to the manifest under each tool's config. Values provided to `extraOutputs` are returned by Apollo MCP Server for the tool result in `structuredContent` to make it accessible to the LLM.

```graphql
query MyQuery
@tool(
  name: "my-tool",
  description: "My tool",
  extraOutputs: { "follow-up-instructions": "Perform a feat of magic" }
) {
  myField
}
```

#### Support `@private` in operations to hide parts of a query result from LLMs

In MCP Apps, you may have data that you want made available to your app but hidden from the LLM. A new `@private` directive is now supported that hides these fields from LLMs:

```
query ProductsQuery {
  topProducts {
    sku
    title
    meta @private {
      createdAt
      barcode
    }
  }
}
```

`@private` directs Apollo MCP Server to remove those fields in `structuredContent` so that the field data is not available to the LLM. The full result is instead added to `_meta`. `@apollo/client-ai-apps` handles reading the query result from the proper location when `@private` is used.

## 0.6.4 (2026-03-13)

### Fixes

#### Always write the manifest in `buildStart`

The Vite plugin currently writes the manifest file in the `writeBundle` phase of the build. This causes issues if you try to build the app before the manifest file is generated since the source code imports the manifest to provide to the `ApolloClient` constructor. This change writes the manifest in `buildStart` to ensure it is available before the build begins.

This change makes it easier to add `.application-manifest.json` to `.gitignore` if you find it too noisy to commit to source control.

## 0.6.3 (2026-03-13)

### Fixes

#### Fix ChatGPT page reload getting stuck

Fixes an issue where reloading the page in ChatGPT would cause the app to get stuck indefinitely. After a reload, ChatGPT does not re-send the `ui/notifications/tool-result` notification, so the app is stuck waiting for an event that would never arrive.

#### Fix issue with operation description on executed queries

Fixes an issue where a query executed by the client through the Apollo MCP Server `execute` tool maintained operation descriptions on the query.

## 0.6.2 (2026-03-12)

### Fixes

#### Strip operation description from manifest `body` field

When a GraphQL operation uses an operation description as the tool description, the description is removed from the operation `body` in the manifest. This fixes a compatibility issue with Apollo MCP Server which currently does not support operation descriptions.

## 0.6.1 (2026-03-11)

### Features

#### Add `useToolInfo` hook

A new `useToolInfo()` hook is now available that combines `useToolName()` and `useToolInput()` into a single hook. `useToolInfo` is more type-safe and automatically narrows the `toolInput` type based on the `toolName`.

```typescript
// With toolInputs registered for "CreateTodo" and "DeleteTodo":
const info = useToolInfo();
// info: { toolName: "CreateTodo"; toolInput: CreateTodoInput }
//     | { toolName: "DeleteTodo"; toolInput: DeleteTodoInput }
//     | undefined

if (info?.toolName === "CreateTodo") {
  // info.toolInput is narrowed to `CreateTodoInput`
  doSomething(info.toolInput.title);
}
```

As a result, `useToolName()` and `useToolInput()` are now deprecated in favor of `useToolInfo()`. These hooks will be removed with the next major version.

#### Generate a TypeScript definition file for `.application-manifest.json`

The Vite plugin now generates a `.application-manifest.json.d.ts` TypeScript declaration file next to `.application-manifest.json`. This file declares the manifest as `ApplicationManifest`, so TypeScript infers the correct type automatically when you import it.

This removes the need to type cast the `manifest` when initializing `ApolloClient`:

```typescript
// before
import manifest from "./.application-manifest.json";

const client = new ApolloClient({
  manifest: manifest as ApplicationManifest, // cast required
});

// after
import manifest from "./.application-manifest.json";

const client = new ApolloClient({
  manifest, // type is inferred as ApplicationManifest
});
```

> [!NOTE]
> This requires the TypeScript `allowArbitraryExtensions` option. Please ensure your `tsconfig.json` extends one of the provided `tsconfig`, or add these compiler options manually:

```json
{
  "compilerOptions": {
    "allowArbitraryExtensions": true,
    "resolveJsonModule": true
  }
}
```

#### Add type-safe tool names

The Vite plugin now generates a `.apollo-client-ai-apps/types/register.d.ts` TypeScript declaration file. This file contains a union of all tool names found in your app's `@tool` directives.

This means the `useToolName()` hook now provides the precise union of tool names instead of `string | undefined`:

```typescript
// before
const toolName = useToolName(); // string | undefined

// after (with @tool directives on "CreateTodo", "DeleteTodo", "UpdateTodo")
const toolName = useToolName(); // "CreateTodo" | "DeleteTodo" | "UpdateTodo" | undefined
```

The generated file is written to `.apollo-client-ai-apps/types/register.d.ts` and is kept up to date as you edit your operations. Add this path to your `tsconfig.json` `include` to ensure these types are included:

```json
{
  "include": ["src", ".apollo-client-ai-apps/types"]
}
```

You might also consider adding `.apollo-client-ai-apps/` to your `.gitignore` since it is fully generated.

The `ToolName` type is exported from `@apollo/client-ai-apps` if you need access to the available tool names for your own utilities.

#### `@tool` `name` and `description` arguments are now optional

The `name` and `description` arguments on the `@tool` directive are now optional. When omitted, they fall back to the operation name and description respectively.

```graphql
## name defaults to "HelloWorldQuery", description defaults to the operation description
"""
Say hello to the world.
"""
query HelloWorldQuery @tool {
  helloWorld
}
```

Tool `name` and `description` are still enforced and must be set either by the operation or the `@tool` arguments. An anonymous operation or an operation that omits the description while using a bare `@tool` directive fails validation.

When an operation has multiple `@tool` directives, `name` and `description` must still be provided explicitly on each directive to avoid ambiguity.

```graphql
## ✅ Valid — each @tool has an explicit name and description
query ProductsQuery
@tool(name: "list-products", description: "List all products")
@tool(name: "search-products", description: "Search products by keyword") {
  products {
    id
    title
  }
}

## ❌ Error — missing name on second @tool when multiple are present
query ProductsQuery
@tool(name: "list-products", description: "List all products")
@tool(description: "Search products") {
  products {
    id
    title
  }
}
```

## 0.6.0 (2026-03-06)

### Breaking Changes

#### Added a new required `appsOutDir` option to the `apolloClientAiApps` Vite plugin

The `apolloClientAiApps` Vite plugin now requires an `appsOutDir` option that controls where build output is written. The value must end with `apps` as the final path segment (e.g. `"dist/apps"`).

```ts
apolloClientAiApps({ targets: ["mcp"], appsOutDir: "dist/apps" });
```

The plugin will now write the application manifest to `<appsOutDir>/<appName>/.application-manifest.json`, where `appName` is taken from the `name` field in your `apollo-client-ai-apps` config or `package.json`. Previously, the output location was derived from `build.outDir` in your Vite config. Setting `build.outDir` alongside this plugin will now emit a warning that it is ignored.

This option replaces `build.outDir`. Setting `build.outDir` now emits a warning and the value is ignored. To migrate, please move the path from `build.outDir` to the `appsOutDir` option in the `apolloClientAiApps` plugin.

```diff
// vite.config.ts
export default defineConfig({
- build: {
-   outDir: "../../apps",
- },
  plugins: [
    apolloClientAiApps({
      targets: ["mcp"],
+     appsOutDir: "../../apps" ,
    }),
  ],
});
```

### Features

#### Add `baseUriDomains` to CSP config

Adds support for configuring `baseUriDomains` in CSP settings. Only available for MCP apps.

#### Add a `useHostContext` hook

Adds a new `useHostContext` hook that returns the current host context from the MCP host.

```typescript
import { useHostContext } from "@apollo/client-ai-apps/react";

function MyComponent() {
  const hostContext = useHostContext();

  // ...
}
```

### Fixes

#### `@modelcontextprotocol/ext-apps` is now a required peer dependency

`@modelcontextprotocol/ext-apps` is now a required peer dependency and must be installed along with this library.

## 0.5.4 (2026-02-27)

### Fixes

#### Fix build when using fragment definitions

Fix an issue where fragment definitions would cause the Vite build to crash.

## 0.5.3 (2026-02-26)

### Features

#### Add `createHydrationUtils` factory and `reactive` helper

Adds a new `createHydrationUtils(query)` factory that returns a `useHydratedVariables` hook. This hook is used to populate `variables` from tool input to ensure the data returned by your query matches what the LLM returned.

```typescript
import { createHydrationUtils, reactive } from "@apollo/client-ai-apps/react";

const MY_QUERY = gql`
  query MyQuery($category: String!, $page: Int) @tool(name: "MyQuery") {
    # ...
  }
`;

const { useHydratedVariables } = createHydrationUtils(MY_QUERY);

function ProductPage({ id, category }: Props) {
  const [variables, setVariables] = useHydratedVariables({
    page: 1, // state: managed internally, seeded from tool input
    sortBy: "title", // state: managed internally, seeded from tool input
    id: reactive(props.id), // reactive: always follows props.id after hydration
    category: reactive(props.category), // reactive: always follows props.category
  });

  const { data } = useQuery(MY_QUERY, { variables });
}
```

## 0.5.2 (2026-02-23)

### Fixes

#### Add fallback when `toolName` is not available from host context

Provides a fallback in MCP apps to get the executed tool name from `_meta.toolName` when the host does not provide `toolInfo` from host context, or `structuredContent.toolName` when the host does not forward `_meta` to the connected application.

#### Always use `window.openai.toolInput` to initialize the tool input value

ChatGPT doesn't always send the `ui/notifications/tool-input` notification before we get `ui/notifications/tool-result`. Other times it sends the notification more than once. Because of the inconsistency, we can't always accurately get the correct tool input value using the notification by the time we get the `ui/notifications/tool-result` notification. This results in the wrong value for `variables` and incorrectly writes the query data to the cache.

This fix falls back to get `toolInput` from `window.openai.toolInput` in ChatGPT apps after we receive the `ui/notification/tool-result` notification to ensure we have the correct tool input value.

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
