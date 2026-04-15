interface McpToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

interface McpToolExport {
  tools: McpToolDefinition[];
  callTool: (name: string, args: Record<string, unknown>) => Promise<unknown>;
}

/**
 * Asana MCP — wraps the Asana REST API (OAuth)
 *
 * Tools:
 * - asana_list_tasks: list tasks in a project
 * - asana_get_task: get a single task by GID
 * - asana_create_task: create a new task
 * - asana_list_projects: list projects in a workspace
 * - asana_search_tasks: search tasks in a workspace
 */


const BASE = 'https://app.asana.com/api/1.0';

interface AsanaContext {
  asana?: { accessToken: string; workspaceGid?: string };
}

// ── Tool definitions ──────────────────────────────────────────────────

const tools: McpToolExport['tools'] = [
  {
    name: 'asana_list_workspaces',
    description: 'List Asana workspaces accessible to the authenticated user. Use this to discover workspace GIDs.',
    inputSchema: { type: 'object' as const, properties: {} },
  },
  {
    name: 'asana_list_tasks',
    description:
      'List tasks in an Asana project. Returns task GID, name, completed status, assignee, and due date.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        project: { type: 'string', description: 'Project GID' },
        completed_since: {
          type: 'string',
          description: 'Only return tasks completed since this date (ISO 8601). Use "now" for incomplete tasks only.',
        },
        limit: {
          type: 'number',
          description: 'Number of tasks to return (default 20, max 100)',
        },
      },
      required: ['project'],
    },
  },
  {
    name: 'asana_get_task',
    description:
      'Get a single Asana task by its GID. Returns full task details including name, notes, assignee, projects, tags, and subtasks.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        task_gid: { type: 'string', description: 'Task GID' },
      },
      required: ['task_gid'],
    },
  },
  {
    name: 'asana_create_task',
    description:
      'Create a new task in Asana. Returns the created task GID, name, and permalink URL.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        name: { type: 'string', description: 'Task name' },
        projects: {
          type: 'string',
          description: 'Comma-separated project GIDs to add the task to',
        },
        workspace: { type: 'string', description: 'Workspace GID (auto-resolved if omitted)' },
        notes: { type: 'string', description: 'Task description / notes' },
        due_on: { type: 'string', description: 'Due date in YYYY-MM-DD format' },
        assignee: { type: 'string', description: 'Assignee GID or email address' },
      },
      required: ['name'],
    },
  },
  {
    name: 'asana_list_projects',
    description:
      'List projects in an Asana workspace. Returns project GID, name, and archived status.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        workspace: { type: 'string', description: 'Workspace GID (auto-resolved if omitted)' },
        limit: {
          type: 'number',
          description: 'Number of projects to return (default 20, max 100)',
        },
      },
    },
  },
  {
    name: 'asana_search_tasks',
    description:
      'Search for tasks in an Asana workspace by text. Returns matching tasks with GID, name, completed status, and assignee.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        workspace: { type: 'string', description: 'Workspace GID (auto-resolved if omitted)' },
        text: { type: 'string', description: 'Search query text' },
        limit: {
          type: 'number',
          description: 'Number of results to return (default 20, max 100)',
        },
      },
      required: ['text'],
    },
  },
];

// ── Helpers ───────────────────────────────────────────────────────────

function getContext(args: Record<string, unknown>): { token: string; defaultWorkspace?: string } {
  const context = (args._context ?? {}) as AsanaContext;
  const token = context.asana?.accessToken;
  if (!token) throw new Error('Asana OAuth token required. Connect Asana via OAuth first.');
  return { token, defaultWorkspace: context.asana?.workspaceGid };
}

async function asanaGet(token: string, path: string, params?: Record<string, string>): Promise<unknown> {
  const qs = params ? `?${new URLSearchParams(params)}` : '';
  const res = await fetch(`${BASE}${path}${qs}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Asana API error ${res.status}: ${text}`);
  }
  return res.json();
}

async function asanaPost(token: string, path: string, body: Record<string, unknown>): Promise<unknown> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({ data: body }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Asana API error ${res.status}: ${text}`);
  }
  return res.json();
}

// ── Tool implementations ─────────────────────────────────────────────

async function listTasks(token: string, project: string, completedSince?: string, limit?: number) {
  const count = Math.min(100, Math.max(1, limit ?? 20));
  const params: Record<string, string> = {
    project,
    limit: String(count),
    opt_fields: 'gid,name,completed,assignee.name,due_on,permalink_url',
  };
  if (completedSince) params.completed_since = completedSince;

  const data = (await asanaGet(token, '/tasks', params)) as { data: unknown[] };
  return { tasks: data.data };
}

async function getTask(token: string, taskGid: string) {
  const params = {
    opt_fields:
      'gid,name,notes,completed,assignee.name,projects.name,tags.name,due_on,due_at,created_at,modified_at,permalink_url,num_subtasks',
  };
  const data = (await asanaGet(token, `/tasks/${encodeURIComponent(taskGid)}`, params)) as {
    data: unknown;
  };
  return data.data;
}

async function createTask(
  token: string,
  name: string,
  workspace: string,
  projects?: string,
  notes?: string,
  dueOn?: string,
  assignee?: string,
) {
  const body: Record<string, unknown> = { name, workspace };
  if (projects) body.projects = projects.split(',').map((p) => p.trim());
  if (notes) body.notes = notes;
  if (dueOn) body.due_on = dueOn;
  if (assignee) body.assignee = assignee;

  const data = (await asanaPost(token, '/tasks', body)) as { data: unknown };
  return data.data;
}

async function listProjects(token: string, workspace: string, limit?: number) {
  const count = Math.min(100, Math.max(1, limit ?? 20));
  const params: Record<string, string> = {
    workspace,
    limit: String(count),
    opt_fields: 'gid,name,archived,permalink_url',
  };
  const data = (await asanaGet(token, '/projects', params)) as { data: unknown[] };
  return { projects: data.data };
}

async function searchTasks(token: string, workspace: string, text: string, limit?: number) {
  const count = Math.min(100, Math.max(1, limit ?? 20));
  const params: Record<string, string> = {
    'text': text,
    'limit': String(count),
    'opt_fields': 'gid,name,completed,assignee.name,due_on,permalink_url',
  };
  const data = (await asanaGet(
    token,
    `/workspaces/${encodeURIComponent(workspace)}/tasks/search`,
    params,
  )) as { data: unknown[] };
  return { tasks: data.data };
}

// ── callTool dispatcher ──────────────────────────────────────────────

async function callTool(name: string, args: Record<string, unknown>): Promise<unknown> {
  const { token, defaultWorkspace } = getContext(args);
  delete args._context;

  // Auto-resolve workspace from context when not provided
  const ws = (args.workspace as string) || defaultWorkspace;

  switch (name) {
    case 'asana_list_workspaces':
      return asanaGet(token, '/workspaces', { limit: '100', opt_fields: 'gid,name' });
    case 'asana_list_tasks':
      return listTasks(
        token,
        args.project as string,
        args.completed_since as string | undefined,
        args.limit as number | undefined,
      );
    case 'asana_get_task':
      return getTask(token, args.task_gid as string);
    case 'asana_create_task': {
      if (!ws) throw new Error('workspace is required');
      return createTask(
        token,
        args.name as string,
        ws,
        args.projects as string | undefined,
        args.notes as string | undefined,
        args.due_on as string | undefined,
        args.assignee as string | undefined,
      );
    }
    case 'asana_list_projects': {
      if (!ws) throw new Error('workspace is required');
      return listProjects(token, ws, args.limit as number | undefined);
    }
    case 'asana_search_tasks': {
      if (!ws) throw new Error('workspace is required');
      return searchTasks(
        token,
        ws,
        args.text as string,
        args.limit as number | undefined,
      );
    }
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

export default { tools, callTool, meter: { credits: 10 }, provider: 'asana' } satisfies McpToolExport;
