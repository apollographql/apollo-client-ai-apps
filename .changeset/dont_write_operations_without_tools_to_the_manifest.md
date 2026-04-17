---
default: patch
---

# Don't write operations without tools to the manifest

Operations defined without the `@tool` or `@prefetch` directives are no longer written to the manifest file. These were already filtered out in the MCP server, though writing these operations logged them as if the tools were defined which was confusing behavior.
