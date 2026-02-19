---
default: patch
---

# Fallback to `window.openai.toolInput` when initializing

ChatGPT doesn't always send the `ui/notifications/tool-input` notification before we get `ui/notifications/tool-result`. Because we don't get input arguments from the notification, we resolve `variables` incorrectly and write data to the cache with the wrong variables. When the query executes, it is unable to read data from the cache and results in a cache miss. This further can result in a GraphQL execution error due to missing required variables.

This fix falls back to get `toolInput` from `window.openai.toolInput` if we haven't received the `ui/notifications/tool-input` notification by the time we get the `ui/notification/tool-result` notification.
