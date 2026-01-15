---
default: major
---

# Make `@apollo/client` a peer dependency

`@apollo/client` is now a peer dependency and must be installed along with this package.

`@apollo/client` exports have also been removed from this package and should be imported from `@apollo/client` instead.

```diff
- import { useQuery } from "@apollo/client-ai-apps";
+ import { useQuery } from "@apollo/client";
```
