# mcp-asana

Asana MCP — wraps the Asana REST API (OAuth)

Part of [Pipeworx](https://pipeworx.io) — an MCP gateway connecting AI agents to 1394+ live data sources.

## Tools

| Tool | Description |
|------|-------------|
| `asana_list_workspaces` | Get all accessible Asana workspaces. Returns workspace names and IDs needed to list projects and tasks. |
| `asana_list_tasks` | List tasks in a project. Returns task ID, name, completion status, assignee, and due date. Requires project ID. |
| `asana_get_task` | Get full task details including name, description, assignee, projects, tags, subtasks, and status. Requires task ID. |
| `asana_create_task` | Create a new task in a project. Returns task ID, name, and permalink. Requires project ID and task name. |
| `asana_list_projects` | List all projects in a workspace. Returns project ID, name, and archived status. Requires workspace ID. |
| `asana_search_tasks` | Search tasks across a workspace by keyword. Returns matching tasks with ID, name, completion status, and assignee. Requires workspace ID. |

## Quick Start

Add to your MCP client (Claude Desktop, Cursor, Windsurf, etc.):

```json
{
  "mcpServers": {
    "asana": {
      "url": "https://gateway.pipeworx.io/asana/mcp"
    }
  }
}
```

Or connect to the full Pipeworx gateway for access to all 1394+ data sources:

```json
{
  "mcpServers": {
    "pipeworx": {
      "url": "https://gateway.pipeworx.io/mcp"
    }
  }
}
```

## Using with ask_pipeworx

Instead of calling tools directly, you can ask questions in plain English:

```
ask_pipeworx({ question: "your question about Asana data" })
```

The gateway picks the right tool and fills the arguments automatically.

## More

- [Docs and guides](https://pipeworx.io/docs)
- [pipeworx.io](https://pipeworx.io)

## License

MIT
