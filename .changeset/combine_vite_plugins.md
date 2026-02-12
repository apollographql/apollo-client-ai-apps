---
default: major
---

# Changes to vite plugins

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
