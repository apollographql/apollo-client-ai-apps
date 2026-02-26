---
default: minor
---

# Add `createHydrationUtils` factory and `reactive` helper

Adds a new `createHydrationUtils(query)` factory that returns a `useHydratedVariables` hook. This hook is used to populate `variables` from tool input to ensure the data returned by your query matches what the LLM returned.

```typescript
import { createHydrationUtils, reactive } from "@apollo/client-ai-apps/react";

const { useHydratedVariables } = createHydrationUtils(QUERY);

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
