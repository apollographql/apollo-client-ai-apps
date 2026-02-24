---
default: minor
---

# Add `useToolInputVariables` hook

Adds a new `useToolInputVariables` hook that seeds GraphQL query variables from tool input when a component is rendered via an AI tool call. If the document's `@tool(name: "...")` directive matches the currently executing tool, variables are initialized from the tool input; otherwise, the provided `defaultVariables` are used. Returns a `[variables, setVariables]` tuple that shallow-merges updates.
