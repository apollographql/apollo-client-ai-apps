---
default: minor
---

# Add `useToolInfo` hook

A new `useToolInfo()` hook is now available that combines `useToolName()` and `useToolInput()` into a single hook. `useToolInfo` is more type-safe and automatically narrows the `toolInput` type based on the `toolName`.

```typescript
// With toolInputs registered for "CreateTodo" and "DeleteTodo":
const info = useToolInfo();
// info: { toolName: "CreateTodo"; toolInput: CreateTodoInput }
//     | { toolName: "DeleteTodo"; toolInput: DeleteTodoInput }
//     | undefined

if (info?.toolName === "CreateTodo") {
  // info.toolInput is narrowed to CreateTodoInput here
  doSomething(info.toolInput.title);
}
```

As a result, `useToolName()` and `useToolInput()` are now deprecated in favor of `useToolInfo()`. These hooks will be removed with the next major version.
