---
default: major
---

# Added a new required `appsOutDir` option to the `apolloClientAiApps` Vite plugin

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
