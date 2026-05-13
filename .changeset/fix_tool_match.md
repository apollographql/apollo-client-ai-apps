---
default: patch
---

# Fix tool match when `@tool` doesn't use arguments

Fix an issue when using `@tool` without arguments where `useHydratedVariables` doesn't match against the tool correctly which causes mismatches in intended query result.
