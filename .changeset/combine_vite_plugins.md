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

## Additional changes

- The MCP app version is now configured by the version your `package.json` file
- You can now provide a custom entry for a specific target. In your `package.json`:
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
