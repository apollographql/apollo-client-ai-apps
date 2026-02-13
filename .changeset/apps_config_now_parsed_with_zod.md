---
default: minor
---

# Apps config now parsed with zod

The apps config and directive inputs are now parsed and validated with [`zod`](https://zod.dev/). Validation is now more strict and does not allow additional properties that don't exist in the validation schemas. Additionally, you may see a change in the format of the error message if a validation error occurs.
