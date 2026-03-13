---
default: patch
---

# Always write the manifest in `buildStart`

The Vite plugin currently writes the manifest file in the `writeBundle` phase of the build. This causes issues if you try to build the app before the manifest file is generated since the source code imports the manifest to provide to the `ApolloClient` constructor. This change writes the manifest in `buildStart` to ensure it is available before the build begins.

This change makes it easier to add `.application-manifest.json` to `.gitignore` if you find it too noisy to commit to source control.
