'use client'

import { useState } from 'react'
import { useMcpServers, MCP_TYPE_LABELS } from '@/app/context/McpContext'

interface McpSelectorProps {
  selectedIds: string[]
  onSelectionChange: (ids: string[]) => void
  disabled?: boolean
}

export function McpSelector({ selectedIds, onSelectionChange, disabled }: McpSelectorProps) {
  const { mcpServers, isLoading, hasMcpServers } = useMcpServers()
  const [isExpanded, setIsExpanded] = useState(false)

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-gray-600 text-sm">
        <span className="animate-spin">◌</span>
        Loading MCP servers...
      </div>
    )
  }

  if (!hasMcpServers) {
    return (
      <div className="text-gray-600 text-xs">
        No MCP servers configured. Add servers in MCP Manager.
      </div>
    )
  }

  const enabledServers = mcpServers.filter(s => s.isEnabled)

  if (enabledServers.length === 0) {
    return (
      <div className="text-gray-600 text-xs">
        All MCP servers are disabled. Enable servers in MCP Manager.
      </div>
    )
  }

  const toggleServer = (id: string) => {
    if (selectedIds.includes(id)) {
      onSelectionChange(selectedIds.filter(sid => sid !== id))
    } else {
      onSelectionChange([...selectedIds, id])
    }
  }

  const selectAll = () => {
    onSelectionChange(enabledServers.map(s => s.id))
  }

  const selectNone = () => {
    onSelectionChange([])
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        disabled={disabled}
        className="flex items-center gap-2 text-xs text-gray-400 hover:text-purple-400 transition-colors disabled:opacity-50"
      >
        <span className={`text-[10px] transition-transform ${isExpanded ? 'rotate-90' : ''}`}>▶</span>
        <span className="uppercase tracking-widest">MCP Servers</span>
        <span className="text-[9px] text-gray-600">
          ({selectedIds.length}/{enabledServers.length} selected)
        </span>
      </button>

      {isExpanded && (
        <div className="pl-4 space-y-2">
          {/* Quick actions */}
          <div className="flex gap-2 text-[10px]">
            <button
              type="button"
              onClick={selectAll}
              disabled={disabled}
              className="text-purple-600 hover:text-purple-400 uppercase tracking-wider disabled:opacity-50"
            >
              Select All
            </button>
            <span className="text-gray-800">|</span>
            <button
              type="button"
              onClick={selectNone}
              disabled={disabled}
              className="text-gray-600 hover:text-gray-400 uppercase tracking-wider disabled:opacity-50"
            >
              Select None
            </button>
          </div>

          {/* Server list */}
          <div className="space-y-1">
            {enabledServers.map(server => (
              <label
                key={server.id}
                className={`
                  flex items-center gap-3 py-1.5 px-2 rounded cursor-pointer
                  hover:bg-black/30 transition-colors
                  ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
                `}
              >
                <input
                  type="checkbox"
                  checked={selectedIds.includes(server.id)}
                  onChange={() => toggleServer(server.id)}
                  disabled={disabled}
                  className="w-4 h-4 accent-purple-500"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-mono ${
                      selectedIds.includes(server.id) ? 'text-purple-300' : 'text-gray-500'
                    }`}>
                      {server.name}
                    </span>
                    <span className={`text-[9px] px-1 rounded ${
                      server.type === 'stdio'
                        ? 'bg-blue-900/50 text-blue-400'
                        : 'bg-cyan-900/50 text-cyan-400'
                    }`}>
                      {MCP_TYPE_LABELS[server.type]}
                    </span>
                  </div>
                  {server.type === 'stdio' && server.command && (
                    <div className="text-[10px] text-gray-700 truncate">
                      {server.command} {server.args?.join(' ')}
                    </div>
                  )}
                  {server.type !== 'stdio' && server.url && (
                    <div className="text-[10px] text-gray-700 truncate">
                      {server.url}
                    </div>
                  )}
                </div>
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
