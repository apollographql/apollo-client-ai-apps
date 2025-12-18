---
default: major
---

Enforces the `cache` option when instantiating the `ApolloClient` instance. This prevents `InMemoryCache` from being bundled when a different `cache` is provided in order to save bundle size.
