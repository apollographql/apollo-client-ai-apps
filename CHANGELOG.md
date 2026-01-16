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
