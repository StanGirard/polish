import { getDb } from './session-store'
import type {
  McpServer,
  McpServerPublic,
  McpServerType,
  McpServerConfig,
  CreateMcpServerRequest,
  UpdateMcpServerRequest
} from './types'

// ============================================================================
// Helpers
// ============================================================================

function generateId(): string {
  return `mcp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function rowToMcpServer(row: Record<string, unknown>): McpServer {
  return {
    id: row.id as string,
    name: row.name as string,
    type: row.type as McpServerType,
    command: row.command as string | undefined,
    args: row.args ? JSON.parse(row.args as string) : undefined,
    env: row.env ? JSON.parse(row.env as string) : undefined,
    url: row.url as string | undefined,
    headers: row.headers ? JSON.parse(row.headers as string) : undefined,
    isEnabled: Boolean(row.is_enabled),
    createdAt: new Date(row.created_at as string),
    updatedAt: new Date(row.updated_at as string)
  }
}

function mcpServerToPublic(server: McpServer): McpServerPublic {
  return { ...server }
}

// ============================================================================
// CRUD Operations
// ============================================================================

/**
 * Create a new MCP server
 */
export function createMcpServer(config: CreateMcpServerRequest): McpServer {
  const db = getDb()
  const id = generateId()
  const now = new Date()

  const server: McpServer = {
    id,
    name: config.name,
    type: config.type,
    command: config.command,
    args: config.args,
    env: config.env,
    url: config.url,
    headers: config.headers,
    isEnabled: config.isEnabled ?? true,
    createdAt: now,
    updatedAt: now
  }

  db.prepare(`
    INSERT INTO mcp_servers (id, name, type, command, args, env, url, headers, is_enabled, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    server.name,
    server.type,
    server.command || null,
    server.args ? JSON.stringify(server.args) : null,
    server.env ? JSON.stringify(server.env) : null,
    server.url || null,
    server.headers ? JSON.stringify(server.headers) : null,
    server.isEnabled ? 1 : 0,
    now.toISOString(),
    now.toISOString()
  )

  return server
}

/**
 * Get an MCP server by ID
 */
export function getMcpServer(id: string): McpServer | undefined {
  const db = getDb()
  const row = db.prepare('SELECT * FROM mcp_servers WHERE id = ?').get(id) as Record<string, unknown> | undefined
  if (!row) return undefined
  return rowToMcpServer(row)
}

/**
 * Get an MCP server by ID (public version)
 */
export function getMcpServerPublic(id: string): McpServerPublic | undefined {
  const server = getMcpServer(id)
  if (!server) return undefined
  return mcpServerToPublic(server)
}

/**
 * Get all MCP servers
 */
export function getAllMcpServers(): McpServer[] {
  const db = getDb()
  const rows = db.prepare('SELECT * FROM mcp_servers ORDER BY created_at DESC').all() as Record<string, unknown>[]
  return rows.map(rowToMcpServer)
}

/**
 * Get all MCP servers (public version)
 */
export function getAllMcpServersPublic(): McpServerPublic[] {
  return getAllMcpServers().map(mcpServerToPublic)
}

/**
 * Get all enabled MCP servers
 */
export function getEnabledMcpServers(): McpServer[] {
  const db = getDb()
  const rows = db.prepare('SELECT * FROM mcp_servers WHERE is_enabled = 1 ORDER BY created_at DESC').all() as Record<string, unknown>[]
  return rows.map(rowToMcpServer)
}

/**
 * Update an MCP server
 */
export function updateMcpServer(id: string, updates: UpdateMcpServerRequest): void {
  const db = getDb()
  const now = new Date()

  const fields: string[] = ['updated_at = ?']
  const values: unknown[] = [now.toISOString()]

  if (updates.name !== undefined) {
    fields.push('name = ?')
    values.push(updates.name)
  }
  if (updates.command !== undefined) {
    fields.push('command = ?')
    values.push(updates.command || null)
  }
  if (updates.args !== undefined) {
    fields.push('args = ?')
    values.push(updates.args ? JSON.stringify(updates.args) : null)
  }
  if (updates.env !== undefined) {
    fields.push('env = ?')
    values.push(updates.env ? JSON.stringify(updates.env) : null)
  }
  if (updates.url !== undefined) {
    fields.push('url = ?')
    values.push(updates.url || null)
  }
  if (updates.headers !== undefined) {
    fields.push('headers = ?')
    values.push(updates.headers ? JSON.stringify(updates.headers) : null)
  }
  if (updates.isEnabled !== undefined) {
    fields.push('is_enabled = ?')
    values.push(updates.isEnabled ? 1 : 0)
  }

  values.push(id)
  db.prepare(`UPDATE mcp_servers SET ${fields.join(', ')} WHERE id = ?`).run(...values)
}

/**
 * Delete an MCP server
 */
export function deleteMcpServer(id: string): { success: boolean; error?: string } {
  const db = getDb()

  const server = getMcpServer(id)
  if (!server) {
    return { success: false, error: 'MCP server not found' }
  }

  db.prepare('DELETE FROM mcp_servers WHERE id = ?').run(id)
  return { success: true }
}

/**
 * Check if any MCP servers are configured
 */
export function hasMcpServers(): boolean {
  const db = getDb()
  const result = db.prepare('SELECT COUNT(*) as count FROM mcp_servers').get() as { count: number }
  return result.count > 0
}

/**
 * Get MCP server count
 */
export function getMcpServerCount(): number {
  const db = getDb()
  const result = db.prepare('SELECT COUNT(*) as count FROM mcp_servers').get() as { count: number }
  return result.count
}

// ============================================================================
// SDK Config Conversion
// ============================================================================

/**
 * Convert stored MCP servers to SDK-compatible config format
 * Optionally filter by specific server IDs
 */
export function toSdkMcpConfig(
  servers: McpServer[],
  enabledServerIds?: string[]
): Record<string, McpServerConfig> {
  const config: Record<string, McpServerConfig> = {}

  for (const server of servers) {
    // Skip if not in enabled list (when list is provided)
    if (enabledServerIds && !enabledServerIds.includes(server.id)) {
      continue
    }

    // Skip globally disabled servers
    if (!server.isEnabled) {
      continue
    }

    if (server.type === 'stdio' && server.command) {
      config[server.name] = {
        type: 'stdio',
        command: server.command,
        args: server.args,
        env: server.env
      }
    } else if ((server.type === 'sse' || server.type === 'http') && server.url) {
      config[server.name] = {
        type: server.type,
        url: server.url,
        headers: server.headers
      }
    }
  }

  return config
}
