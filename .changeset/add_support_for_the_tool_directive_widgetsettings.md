---
default: minor
---

Add support for `widgetSettings` in the manifest file. This includes `widgetSettngs.prefersBorder`, `widgetSettings.description`, and `widgetSettings.domain`.

```json
// package.json
{
  // ...
  "widgetSettings": {
    "prefersBorder": true,
    "description": "Widget description",
    "domain": "https://example.com"
  }
}
```
