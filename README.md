# mcp-asana

Asana MCP — wraps the Asana REST API (OAuth)

Part of the [Pipeworx](https://pipeworx.io) open MCP gateway.

## Tools

| Tool | Description |
|------|-------------|
| `asana_list_workspaces` | List Asana workspaces accessible to the authenticated user. Use this to discover workspace GIDs. |

## Quick Start

Add to your MCP client config:

```json
{
  "mcpServers": {
    "asana": {
      "url": "https://gateway.pipeworx.io/asana/mcp"
    }
  }
}
```

Or use the CLI:

```bash
npx pipeworx use asana
```

## License

MIT
