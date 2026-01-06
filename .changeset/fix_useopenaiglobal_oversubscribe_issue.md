---
default: patch
---

Fix an issue where the `useOpenAiGlobal` unnecessarily tears down and sets up event listeners on every render.
