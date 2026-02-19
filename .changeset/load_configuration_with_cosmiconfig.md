---
default: major
---

# Load configuration with cosmiconfig

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

## Type-safe configuration

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
