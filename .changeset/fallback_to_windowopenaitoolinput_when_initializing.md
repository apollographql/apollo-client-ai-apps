---
default: patch
---

# Always use `window.openai.toolInput` to initialize the tool input value

ChatGPT doesn't always send the `ui/notifications/tool-input` notification before we get `ui/notifications/tool-result`. Other times it sends the notification more than once. Because of the inconsistency, we can't always accurately get the correct tool input value using the notification by the time we get the `ui/notifications/tool-result` notification. This results in the wrong value for `variables` and incorrectly writes the query data to the cache.

This fix falls back to get `toolInput` from `window.openai.toolInput` in ChatGPT apps after we receive the `ui/notification/tool-result` notification to ensure we have the correct tool input value.
