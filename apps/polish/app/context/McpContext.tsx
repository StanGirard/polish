'use client'

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { apiFetch } from '@/app/lib/api-client'

// ============================================================================
// Types
// ============================================================================

export type McpServerType = 'stdio' | 'sse' | 'http'

export interface McpServerPublic {
  id: string
  name: string
  type: McpServerType
  command?: string
  args?: string[]
  env?: Record<string, string>
  url?: string
  headers?: Record<string, string>
  isEnabled: boolean
  createdAt: string
  updatedAt: string
}

export interface CreateMcpServerRequest {
  name: string
  type: McpServerType
  command?: string
  args?: string[]
  env?: Record<string, string>
  url?: string
  headers?: Record<string, string>
  isEnabled?: boolean
}

export interface UpdateMcpServerRequest {
  name?: string
  command?: string
  args?: string[]
  env?: Record<string, string>
  url?: string
  headers?: Record<string, string>
  isEnabled?: boolean
}

interface McpContextValue {
  mcpServers: McpServerPublic[]
  isLoading: boolean
  error: string | null
  hasMcpServers: boolean
  enabledCount: number
  refreshMcpServers: () => Promise<void>
  createMcpServer: (config: CreateMcpServerRequest) => Promise<McpServerPublic>
  updateMcpServer: (id: string, updates: UpdateMcpServerRequest) => Promise<void>
  deleteMcpServer: (id: string) => Promise<void>
  testMcpServer: (id: string) => Promise<{ success: boolean; error?: string; tools?: string[]; latencyMs?: number }>
  toggleMcpServer: (id: string) => Promise<void>
}

// ============================================================================
// Context
// ============================================================================

const McpContext = createContext<McpContextValue | null>(null)

export function McpProvider({ children }: { children: React.ReactNode }) {
  const [mcpServers, setMcpServers] = useState<McpServerPublic[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refreshMcpServers = useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)
      const response = await apiFetch('/api/mcp-servers')
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch MCP servers')
      }

      setMcpServers(data.servers || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch MCP servers')
      console.error('Failed to fetch MCP servers:', err)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    refreshMcpServers()
  }, [refreshMcpServers])

  const createMcpServer = useCallback(async (config: CreateMcpServerRequest): Promise<McpServerPublic> => {
    const response = await apiFetch('/api/mcp-servers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config)
    })

    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.error || 'Failed to create MCP server')
    }

    await refreshMcpServers()
    return data.server
  }, [refreshMcpServers])

  const updateMcpServer = useCallback(async (id: string, updates: UpdateMcpServerRequest): Promise<void> => {
    const response = await apiFetch(`/api/mcp-servers/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates)
    })

    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.error || 'Failed to update MCP server')
    }

    await refreshMcpServers()
  }, [refreshMcpServers])

  const deleteMcpServer = useCallback(async (id: string): Promise<void> => {
    const response = await apiFetch(`/api/mcp-servers/${id}`, {
      method: 'DELETE'
    })

    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.error || 'Failed to delete MCP server')
    }

    await refreshMcpServers()
  }, [refreshMcpServers])

  const testMcpServer = useCallback(async (id: string): Promise<{ success: boolean; error?: string; tools?: string[]; latencyMs?: number }> => {
    const response = await apiFetch(`/api/mcp-servers/${id}/test`, {
      method: 'POST'
    })

    const data = await response.json()
    return {
      success: data.success,
      error: data.error,
      tools: data.tools,
      latencyMs: data.latencyMs
    }
  }, [])

  const toggleMcpServer = useCallback(async (id: string): Promise<void> => {
    const server = mcpServers.find(s => s.id === id)
    if (!server) return

    await updateMcpServer(id, { isEnabled: !server.isEnabled })
  }, [mcpServers, updateMcpServer])

  const hasMcpServers = mcpServers.length > 0
  const enabledCount = mcpServers.filter(s => s.isEnabled).length

  return (
    <McpContext.Provider
      value={{
        mcpServers,
        isLoading,
        error,
        hasMcpServers,
        enabledCount,
        refreshMcpServers,
        createMcpServer,
        updateMcpServer,
        deleteMcpServer,
        testMcpServer,
        toggleMcpServer
      }}
    >
      {children}
    </McpContext.Provider>
  )
}

export function useMcpServers(): McpContextValue {
  const context = useContext(McpContext)
  if (!context) {
    throw new Error('useMcpServers must be used within a McpProvider')
  }
  return context
}

// ============================================================================
// Constants
// ============================================================================

export const MCP_TYPE_LABELS: Record<McpServerType, string> = {
  stdio: 'Local (stdio)',
  sse: 'Remote (SSE)',
  http: 'Remote (HTTP)'
}

export const MCP_TYPE_DESCRIPTIONS: Record<McpServerType, string> = {
  stdio: 'Runs a local command that communicates via stdin/stdout',
  sse: 'Connects to a remote server using Server-Sent Events',
  http: 'Connects to a remote server using HTTP requests'
}
