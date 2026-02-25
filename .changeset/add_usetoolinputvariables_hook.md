---
default: minor
---

# Add `createHydratedVariables` factory and `reactive` helper

Replaces `useToolInputVariables` with a new `createHydratedVariables(QUERY)` factory that returns a `useHydratedVariables` hook. The new API follows an SSR/hydration mental model: the first render uses tool input values to avoid query variable mismatches; after that, state variables are locally controlled (via `setVariables`) and reactive variables automatically follow their provided values.

A companion `reactive()` helper marks specific variables as "reactive" — always following an externally-provided value (e.g. a prop from URL params) rather than being managed as internal state.

```typescript
import { createHydratedVariables, reactive } from "@apollo/client-ai-apps/mcp";

const { useHydratedVariables } = createHydratedVariables(QUERY);

function ProductPage({ id, category }: Props) {
  const [variables, setVariables] = useHydratedVariables({
    page: 1, // state: managed internally, seeded from tool input
    sortBy: "title", // state: managed internally, seeded from tool input
    id: reactive(props.id), // reactive: always follows props.id after hydration
    category: reactive(props.category), // reactive: always follows props.category
  });

  const { data } = useQuery(QUERY, { variables });
}
```
