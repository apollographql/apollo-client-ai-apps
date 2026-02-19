---
default: minor
---

# Support for platform-specific entry point config

You can now provide a custom entry for a specific target. In your `package.json`:

```json
{
  "entry": {
    "production": {
      "mcp": "https://mcp.example.com",
      "openai": "https://openai.example.com"
    }
  }
}
```

The MCP app version is now configured by the version your `package.json` file
