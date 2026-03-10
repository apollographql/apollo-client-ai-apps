---
default: minor
---

# Generate a TypeScript definition file for `.application-manifest.json`

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
