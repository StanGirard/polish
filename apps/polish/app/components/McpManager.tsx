'use client'

import { useState, useEffect } from 'react'
import {
  useMcpServers,
  MCP_TYPE_LABELS,
  MCP_TYPE_DESCRIPTIONS,
  type McpServerType,
  type McpServerPublic,
  type CreateMcpServerRequest
} from '@/app/context/McpContext'

interface McpManagerProps {
  isOpen: boolean
  onClose: () => void
}

type ViewMode = 'list' | 'add' | 'edit'

const MCP_TYPES: McpServerType[] = ['stdio', 'sse', 'http']

export function McpManager({ isOpen, onClose }: McpManagerProps) {
  const {
    mcpServers,
    isLoading,
    error,
    createMcpServer,
    updateMcpServer,
    deleteMcpServer,
    testMcpServer,
    toggleMcpServer
  } = useMcpServers()

  const [viewMode, setViewMode] = useState<ViewMode>('list')
  const [editingServer, setEditingServer] = useState<McpServerPublic | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [testStatus, setTestStatus] = useState<Record<string, 'idle' | 'testing' | 'success' | 'error'>>({})
  const [testErrors, setTestErrors] = useState<Record<string, string>>({})
  const [testLatency, setTestLatency] = useState<Record<string, number>>({})

  // Form state
  const [formData, setFormData] = useState<{
    name: string
    type: McpServerType
    command: string
    args: string
    env: { key: string; value: string }[]
    url: string
    headers: { key: string; value: string }[]
    isEnabled: boolean
  }>({
    name: '',
    type: 'stdio',
    command: '',
    args: '',
    env: [],
    url: '',
    headers: [],
    isEnabled: true
  })

  // Reset form when opening
  useEffect(() => {
    if (isOpen) {
      setViewMode('list')
      setEditingServer(null)
      setFormError(null)
      resetForm()
    }
  }, [isOpen])

  const resetForm = () => {
    setFormData({
      name: '',
      type: 'stdio',
      command: '',
      args: '',
      env: [],
      url: '',
      headers: [],
      isEnabled: true
    })
    setFormError(null)
  }

  const handleTypeChange = (type: McpServerType) => {
    setFormData(prev => ({ ...prev, type }))
  }

  const handleAddNew = () => {
    resetForm()
    setViewMode('add')
  }

  const handleEdit = (server: McpServerPublic) => {
    setEditingServer(server)
    setFormData({
      name: server.name,
      type: server.type,
      command: server.command || '',
      args: server.args?.join(', ') || '',
      env: Object.entries(server.env || {}).map(([key, value]) => ({ key, value })),
      url: server.url || '',
      headers: Object.entries(server.headers || {}).map(([key, value]) => ({ key, value })),
      isEnabled: server.isEnabled
    })
    setViewMode('edit')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError(null)

    try {
      // Convert form data to request format
      const args = formData.args.split(',').map(s => s.trim()).filter(Boolean)
      const env = formData.env.reduce((acc, { key, value }) => {
        if (key.trim()) acc[key.trim()] = value
        return acc
      }, {} as Record<string, string>)
      const headers = formData.headers.reduce((acc, { key, value }) => {
        if (key.trim()) acc[key.trim()] = value
        return acc
      }, {} as Record<string, string>)

      if (viewMode === 'add') {
        await createMcpServer({
          name: formData.name,
          type: formData.type,
          command: formData.type === 'stdio' ? formData.command : undefined,
          args: formData.type === 'stdio' && args.length > 0 ? args : undefined,
          env: formData.type === 'stdio' && Object.keys(env).length > 0 ? env : undefined,
          url: formData.type !== 'stdio' ? formData.url : undefined,
          headers: formData.type !== 'stdio' && Object.keys(headers).length > 0 ? headers : undefined,
          isEnabled: formData.isEnabled
        })
      } else if (viewMode === 'edit' && editingServer) {
        await updateMcpServer(editingServer.id, {
          name: formData.name,
          command: formData.type === 'stdio' ? formData.command : undefined,
          args: formData.type === 'stdio' ? args : undefined,
          env: formData.type === 'stdio' ? env : undefined,
          url: formData.type !== 'stdio' ? formData.url : undefined,
          headers: formData.type !== 'stdio' ? headers : undefined,
          isEnabled: formData.isEnabled
        })
      }

      setViewMode('list')
      resetForm()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Operation failed')
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this MCP server?')) return

    try {
      await deleteMcpServer(id)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete MCP server')
    }
  }

  const handleTest = async (id: string) => {
    setTestStatus(prev => ({ ...prev, [id]: 'testing' }))
    setTestErrors(prev => ({ ...prev, [id]: '' }))
    setTestLatency(prev => ({ ...prev, [id]: 0 }))

    try {
      const result = await testMcpServer(id)
      setTestStatus(prev => ({ ...prev, [id]: result.success ? 'success' : 'error' }))
      if (!result.success && result.error) {
        setTestErrors(prev => ({ ...prev, [id]: result.error! }))
      }
      if (result.latencyMs) {
        setTestLatency(prev => ({ ...prev, [id]: result.latencyMs! }))
      }
    } catch (err) {
      setTestStatus(prev => ({ ...prev, [id]: 'error' }))
      setTestErrors(prev => ({ ...prev, [id]: err instanceof Error ? err.message : 'Test failed' }))
    }
  }

  const handleToggle = async (id: string) => {
    try {
      await toggleMcpServer(id)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to toggle MCP server')
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-black border border-purple-500/50 rounded-lg max-w-2xl w-full mx-4 shadow-2xl max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="border-b border-purple-900/50 px-6 py-4 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-purple-400">◆</span>
              <h2 className="text-purple-400 text-sm uppercase tracking-widest font-bold">
                {viewMode === 'list' ? 'MCP Servers' : viewMode === 'add' ? 'Add MCP Server' : 'Edit MCP Server'}
              </h2>
            </div>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-300 text-xl leading-none"
            >
              ×
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="px-6 py-5 overflow-y-auto flex-1">
          {viewMode === 'list' ? (
            <McpServerList
              servers={mcpServers}
              isLoading={isLoading}
              error={error}
              testStatus={testStatus}
              testErrors={testErrors}
              testLatency={testLatency}
              onAddNew={handleAddNew}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onTest={handleTest}
              onToggle={handleToggle}
            />
          ) : (
            <McpServerForm
              formData={formData}
              setFormData={setFormData}
              formError={formError}
              isEdit={viewMode === 'edit'}
              onTypeChange={handleTypeChange}
              onSubmit={handleSubmit}
              onCancel={() => {
                setViewMode('list')
                resetForm()
              }}
            />
          )}
        </div>
      </div>
    </div>
  )
}

// ============================================================================
// MCP Server List
// ============================================================================

interface McpServerListProps {
  servers: McpServerPublic[]
  isLoading: boolean
  error: string | null
  testStatus: Record<string, 'idle' | 'testing' | 'success' | 'error'>
  testErrors: Record<string, string>
  testLatency: Record<string, number>
  onAddNew: () => void
  onEdit: (server: McpServerPublic) => void
  onDelete: (id: string) => void
  onTest: (id: string) => void
  onToggle: (id: string) => void
}

function McpServerList({
  servers,
  isLoading,
  error,
  testStatus,
  testErrors,
  testLatency,
  onAddNew,
  onEdit,
  onDelete,
  onTest,
  onToggle
}: McpServerListProps) {
  if (isLoading) {
    return (
      <div className="text-center py-8">
        <span className="text-purple-400 animate-spin">◌</span>
        <span className="text-gray-500 ml-2">Loading MCP servers...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-red-400 text-sm bg-red-900/20 border border-red-900/30 rounded px-3 py-2">
        {error}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Add button */}
      <button
        onClick={onAddNew}
        className="w-full px-4 py-3 border border-dashed border-purple-700/50 rounded text-purple-400 hover:bg-purple-900/20 hover:border-purple-500/50 transition-colors text-sm"
      >
        + Add New MCP Server
      </button>

      {/* Server list */}
      {servers.length === 0 ? (
        <div className="text-center py-8 text-gray-600">
          <p className="mb-2">No MCP servers configured</p>
          <p className="text-xs">Add MCP servers to extend Claude with custom tools</p>
        </div>
      ) : (
        <div className="space-y-3">
          {servers.map(server => (
            <div
              key={server.id}
              className={`border rounded p-4 ${
                server.isEnabled
                  ? 'border-purple-500/50 bg-purple-900/10'
                  : 'border-gray-800 bg-gray-900/30 opacity-60'
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`font-medium truncate ${server.isEnabled ? 'text-purple-300' : 'text-gray-500'}`}>
                      {server.name}
                    </span>
                    <span className={`text-[9px] px-1.5 py-0.5 rounded uppercase tracking-wider ${
                      server.type === 'stdio'
                        ? 'bg-blue-900/50 text-blue-400'
                        : 'bg-cyan-900/50 text-cyan-400'
                    }`}>
                      {MCP_TYPE_LABELS[server.type]}
                    </span>
                    {!server.isEnabled && (
                      <span className="text-[9px] px-1.5 py-0.5 bg-gray-800 text-gray-500 rounded uppercase tracking-wider">
                        Disabled
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-gray-500 truncate">
                    {server.type === 'stdio' ? (
                      <span className="font-mono">
                        {server.command} {server.args?.join(' ')}
                      </span>
                    ) : (
                      <span className="font-mono">{server.url}</span>
                    )}
                  </div>
                  {testLatency[server.id] > 0 && testStatus[server.id] === 'success' && (
                    <div className="text-[10px] text-green-500 mt-1">
                      Connected ({testLatency[server.id]}ms)
                    </div>
                  )}
                  {testErrors[server.id] && (
                    <div className="text-xs text-red-400 mt-2">
                      {testErrors[server.id]}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  {/* Test status indicator */}
                  {testStatus[server.id] === 'testing' && (
                    <span className="text-purple-400 animate-spin">◌</span>
                  )}
                  {testStatus[server.id] === 'success' && (
                    <span className="text-green-400">●</span>
                  )}
                  {testStatus[server.id] === 'error' && (
                    <span className="text-red-400">●</span>
                  )}

                  {/* Action buttons */}
                  <button
                    onClick={() => onTest(server.id)}
                    disabled={testStatus[server.id] === 'testing'}
                    className="px-2 py-1 text-[10px] border border-cyan-700/50 text-cyan-400 rounded hover:bg-cyan-900/20 disabled:opacity-50 uppercase tracking-wider"
                  >
                    Test
                  </button>
                  <button
                    onClick={() => onToggle(server.id)}
                    className={`px-2 py-1 text-[10px] border rounded uppercase tracking-wider ${
                      server.isEnabled
                        ? 'border-yellow-700/50 text-yellow-500 hover:bg-yellow-900/20'
                        : 'border-green-700/50 text-green-500 hover:bg-green-900/20'
                    }`}
                  >
                    {server.isEnabled ? 'Disable' : 'Enable'}
                  </button>
                  <button
                    onClick={() => onEdit(server)}
                    className="px-2 py-1 text-[10px] border border-gray-700 text-gray-400 rounded hover:bg-gray-800 uppercase tracking-wider"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => onDelete(server.id)}
                    className="px-2 py-1 text-[10px] border border-red-900/50 text-red-500 rounded hover:bg-red-900/20 uppercase tracking-wider"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Help text */}
      <div className="border-t border-purple-900/30 pt-4 mt-4">
        <p className="text-[10px] text-gray-600 leading-relaxed">
          MCP (Model Context Protocol) servers extend Claude with custom tools and capabilities.
          Enabled servers will be available during sessions. You can select which servers to use
          when creating a new session.
        </p>
      </div>
    </div>
  )
}

// ============================================================================
// MCP Server Form
// ============================================================================

interface McpServerFormProps {
  formData: {
    name: string
    type: McpServerType
    command: string
    args: string
    env: { key: string; value: string }[]
    url: string
    headers: { key: string; value: string }[]
    isEnabled: boolean
  }
  setFormData: React.Dispatch<React.SetStateAction<{
    name: string
    type: McpServerType
    command: string
    args: string
    env: { key: string; value: string }[]
    url: string
    headers: { key: string; value: string }[]
    isEnabled: boolean
  }>>
  formError: string | null
  isEdit: boolean
  onTypeChange: (type: McpServerType) => void
  onSubmit: (e: React.FormEvent) => void
  onCancel: () => void
}

function McpServerForm({
  formData,
  setFormData,
  formError,
  isEdit,
  onTypeChange,
  onSubmit,
  onCancel
}: McpServerFormProps) {
  const isStdio = formData.type === 'stdio'

  const addEnvVar = () => {
    setFormData(prev => ({
      ...prev,
      env: [...prev.env, { key: '', value: '' }]
    }))
  }

  const removeEnvVar = (index: number) => {
    setFormData(prev => ({
      ...prev,
      env: prev.env.filter((_, i) => i !== index)
    }))
  }

  const addHeader = () => {
    setFormData(prev => ({
      ...prev,
      headers: [...prev.headers, { key: '', value: '' }]
    }))
  }

  const removeHeader = (index: number) => {
    setFormData(prev => ({
      ...prev,
      headers: prev.headers.filter((_, i) => i !== index)
    }))
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {/* Name */}
      <div>
        <label className="block text-[10px] text-purple-700 uppercase tracking-widest mb-2">
          Name
        </label>
        <input
          type="text"
          value={formData.name}
          onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
          placeholder="My MCP Server"
          required
          className="w-full bg-black border border-purple-900/50 rounded px-4 py-3 text-purple-300 placeholder-gray-700 focus:outline-none focus:border-purple-500/50 font-mono text-sm"
        />
      </div>

      {/* Type */}
      {!isEdit && (
        <div>
          <label className="block text-[10px] text-purple-700 uppercase tracking-widest mb-2">
            Server Type
          </label>
          <div className="grid grid-cols-3 gap-2">
            {MCP_TYPES.map(type => (
              <button
                key={type}
                type="button"
                onClick={() => onTypeChange(type)}
                className={`px-3 py-2 text-xs border rounded transition-colors ${
                  formData.type === type
                    ? 'border-purple-500 bg-purple-900/30 text-purple-300'
                    : 'border-gray-800 text-gray-500 hover:border-gray-700'
                }`}
              >
                <div className="font-medium">{MCP_TYPE_LABELS[type]}</div>
              </button>
            ))}
          </div>
          <p className="text-[10px] text-gray-600 mt-2">
            {MCP_TYPE_DESCRIPTIONS[formData.type]}
          </p>
        </div>
      )}

      {/* Stdio-specific fields */}
      {isStdio ? (
        <>
          {/* Command */}
          <div>
            <label className="block text-[10px] text-purple-700 uppercase tracking-widest mb-2">
              Command
            </label>
            <input
              type="text"
              value={formData.command}
              onChange={e => setFormData(prev => ({ ...prev, command: e.target.value }))}
              placeholder="npx"
              required
              className="w-full bg-black border border-purple-900/50 rounded px-4 py-3 text-purple-300 placeholder-gray-700 focus:outline-none focus:border-purple-500/50 font-mono text-sm"
            />
          </div>

          {/* Args */}
          <div>
            <label className="block text-[10px] text-purple-700 uppercase tracking-widest mb-2">
              Arguments <span className="text-gray-600">(comma-separated)</span>
            </label>
            <input
              type="text"
              value={formData.args}
              onChange={e => setFormData(prev => ({ ...prev, args: e.target.value }))}
              placeholder="@modelcontextprotocol/server-filesystem, /path/to/dir"
              className="w-full bg-black border border-purple-900/50 rounded px-4 py-3 text-purple-300 placeholder-gray-700 focus:outline-none focus:border-purple-500/50 font-mono text-sm"
            />
          </div>

          {/* Environment Variables */}
          <div>
            <label className="block text-[10px] text-purple-700 uppercase tracking-widest mb-2">
              Environment Variables
            </label>
            <div className="space-y-2">
              {formData.env.map((envVar, index) => (
                <div key={index} className="flex gap-2">
                  <input
                    type="text"
                    value={envVar.key}
                    onChange={e => {
                      const newEnv = [...formData.env]
                      newEnv[index].key = e.target.value
                      setFormData(prev => ({ ...prev, env: newEnv }))
                    }}
                    placeholder="KEY"
                    className="flex-1 bg-black border border-purple-900/50 rounded px-3 py-2 text-purple-300 placeholder-gray-700 focus:outline-none focus:border-purple-500/50 font-mono text-sm"
                  />
                  <input
                    type="text"
                    value={envVar.value}
                    onChange={e => {
                      const newEnv = [...formData.env]
                      newEnv[index].value = e.target.value
                      setFormData(prev => ({ ...prev, env: newEnv }))
                    }}
                    placeholder="value"
                    className="flex-1 bg-black border border-purple-900/50 rounded px-3 py-2 text-purple-300 placeholder-gray-700 focus:outline-none focus:border-purple-500/50 font-mono text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => removeEnvVar(index)}
                    className="px-2 py-1 text-red-500 hover:bg-red-900/20 rounded"
                  >
                    ×
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={addEnvVar}
                className="text-xs text-purple-500 hover:text-purple-400"
              >
                + Add environment variable
              </button>
            </div>
          </div>
        </>
      ) : (
        <>
          {/* URL */}
          <div>
            <label className="block text-[10px] text-purple-700 uppercase tracking-widest mb-2">
              Server URL
            </label>
            <input
              type="url"
              value={formData.url}
              onChange={e => setFormData(prev => ({ ...prev, url: e.target.value }))}
              placeholder="https://api.example.com/mcp"
              required
              className="w-full bg-black border border-purple-900/50 rounded px-4 py-3 text-purple-300 placeholder-gray-700 focus:outline-none focus:border-purple-500/50 font-mono text-sm"
            />
          </div>

          {/* Headers */}
          <div>
            <label className="block text-[10px] text-purple-700 uppercase tracking-widest mb-2">
              Headers
            </label>
            <div className="space-y-2">
              {formData.headers.map((header, index) => (
                <div key={index} className="flex gap-2">
                  <input
                    type="text"
                    value={header.key}
                    onChange={e => {
                      const newHeaders = [...formData.headers]
                      newHeaders[index].key = e.target.value
                      setFormData(prev => ({ ...prev, headers: newHeaders }))
                    }}
                    placeholder="Authorization"
                    className="flex-1 bg-black border border-purple-900/50 rounded px-3 py-2 text-purple-300 placeholder-gray-700 focus:outline-none focus:border-purple-500/50 font-mono text-sm"
                  />
                  <input
                    type="password"
                    value={header.value}
                    onChange={e => {
                      const newHeaders = [...formData.headers]
                      newHeaders[index].value = e.target.value
                      setFormData(prev => ({ ...prev, headers: newHeaders }))
                    }}
                    placeholder="Bearer sk-..."
                    className="flex-1 bg-black border border-purple-900/50 rounded px-3 py-2 text-purple-300 placeholder-gray-700 focus:outline-none focus:border-purple-500/50 font-mono text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => removeHeader(index)}
                    className="px-2 py-1 text-red-500 hover:bg-red-900/20 rounded"
                  >
                    ×
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={addHeader}
                className="text-xs text-purple-500 hover:text-purple-400"
              >
                + Add header
              </button>
            </div>
          </div>
        </>
      )}

      {/* Enabled checkbox */}
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="isEnabled"
          checked={formData.isEnabled}
          onChange={e => setFormData(prev => ({ ...prev, isEnabled: e.target.checked }))}
          className="w-4 h-4 accent-purple-500"
        />
        <label htmlFor="isEnabled" className="text-sm text-gray-400">
          Enable this server
        </label>
      </div>

      {/* Error */}
      {formError && (
        <div className="text-red-400 text-xs bg-red-900/20 border border-red-900/30 rounded px-3 py-2">
          {formError}
        </div>
      )}

      {/* Buttons */}
      <div className="flex gap-3 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 px-4 py-2 border border-gray-700 text-gray-500 rounded hover:bg-gray-900/50 hover:text-gray-400 text-sm uppercase tracking-wider"
        >
          Cancel
        </button>
        <button
          type="submit"
          className="flex-1 px-4 py-2 bg-purple-600/30 border border-purple-500 text-purple-300 rounded hover:bg-purple-600/50 text-sm uppercase tracking-wider"
        >
          {isEdit ? 'Save Changes' : 'Add Server'}
        </button>
      </div>
    </form>
  )
}

// ============================================================================
// Header Indicator
// ============================================================================

export function McpIndicator({ onClick }: { onClick: () => void }) {
  const { hasMcpServers, enabledCount, isLoading } = useMcpServers()

  if (isLoading) {
    return (
      <button
        onClick={onClick}
        className="flex items-center gap-1.5 px-2 py-1 rounded text-[10px] uppercase tracking-widest border border-gray-700 text-gray-600"
      >
        <span className="animate-spin">◌</span>
        Loading
      </button>
    )
  }

  return (
    <button
      onClick={onClick}
      className={`
        flex items-center gap-1.5 px-2 py-1 rounded text-[10px] uppercase tracking-widest
        border transition-colors
        ${
          hasMcpServers
            ? 'border-purple-500/30 text-purple-400 hover:bg-purple-900/20'
            : 'border-gray-700 text-gray-600 hover:bg-gray-900/20'
        }
      `}
      title={hasMcpServers ? `${enabledCount} MCP server(s) enabled` : 'No MCP servers configured'}
    >
      <span className={hasMcpServers ? 'text-purple-400' : 'text-gray-600'}>
        ◆
      </span>
      {hasMcpServers ? `${enabledCount} MCP` : 'No MCP'}
    </button>
  )
}
