## 0.3.3 (2026-01-13)

### Features

#### Add support for `widgetSettings` in the manifest file

This includes `widgetSettngs.prefersBorder`, `widgetSettings.description`, and `widgetSettings.domain`.

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

These map to the OpenAI meta fields:

- `widgetSettings.description` -> `openai/widgetDescription`
- `widgetSettings.domain` -> `openai/widgetDomain`
- `widgetSettings.prefersBorder` -> `openai/widgetPrefersBorder,`
