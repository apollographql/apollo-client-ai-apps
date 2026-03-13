---
default: patch
---

# Fix ChatGPT page reload getting stuck

Fixes an issue where reloading the page in ChatGPT would cause the app to get stuck indefinitely. After a reload, ChatGPT does not re-send the `ui/notifications/tool-result` notification, so the app is stuck waiting for an event that would never arrive.
