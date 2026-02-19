---
default: patch
---

# Fixes the type of `ApolloClientAiAppsConfig.Config`

The `ApolloClientAiAppsConfig.Config` is mistakenly set as the output type instead of the input type. This primarily affected the `labels` config which expected a different input shape than the output shape.
