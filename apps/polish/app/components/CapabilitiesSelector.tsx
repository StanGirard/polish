'use client'

import { useState } from 'react'
import type { CapabilityOverride, ExecutionPhase } from '@/lib/types'

interface CapabilitiesConfig {
  tools: string[]
  mcpServers: string[]
  plugins: Array<{ type: string; id: string }>
  agents: string[]
}

interface CapabilitiesSelectorProps {
  capabilities: CapabilitiesConfig
  overrides: CapabilityOverride[]
  onOverridesChange: (overrides: CapabilityOverride[]) => void
}

const PHASE_OPTIONS: { value: ExecutionPhase[]; label: string }[] = [
  { value: ['both'], label: 'Both' },
  { value: ['implement'], label: 'Implement' },
  { value: ['polish'], label: 'Polish' }
]

export function CapabilitiesSelector({
  capabilities,
  overrides,
  onOverridesChange
}: CapabilitiesSelectorProps) {
  const [expandedSection, setExpandedSection] = useState<string | null>(null)

  const isEnabled = (type: CapabilityOverride['type'], id: string): boolean => {
    const override = overrides.find(o => o.type === type && o.id === id)
    return override?.enabled ?? true // Default to enabled
  }

  const toggleCapability = (type: CapabilityOverride['type'], id: string) => {
    const existingIndex = overrides.findIndex(o => o.type === type && o.id === id)
    const currentEnabled = isEnabled(type, id)

    if (existingIndex >= 0) {
      // Update existing override
      const newOverrides = [...overrides]
      newOverrides[existingIndex] = { ...newOverrides[existingIndex], enabled: !currentEnabled }
      onOverridesChange(newOverrides)
    } else {
      // Add new override (disabling)
      onOverridesChange([...overrides, { type, id, enabled: false, phases: ['both'] }])
    }
  }

  const renderToggle = (enabled: boolean, onClick: () => void) => (
    <button
      type="button"
      onClick={onClick}
      className={`
        relative w-10 h-5 rounded-full transition-all
        ${enabled
          ? 'bg-green-600/40 border border-green-400'
          : 'bg-gray-800/50 border border-gray-700'}
      `}
    >
      <span
        className={`
          absolute top-0.5 w-4 h-4 rounded-full transition-all
          ${enabled
            ? 'left-5 bg-green-400'
            : 'left-0.5 bg-gray-600'}
        `}
      />
    </button>
  )

  const SectionHeader = ({ title, count, isOpen, onClick }: {
    title: string
    count: number
    isOpen: boolean
    onClick: () => void
  }) => (
    <button
      onClick={onClick}
      className="w-full flex items-center justify-between py-2 px-3 bg-black/30 hover:bg-black/50 rounded transition-all"
    >
      <div className="flex items-center gap-2">
        <span className={`text-[10px] transition-transform ${isOpen ? 'rotate-90' : ''}`}>▶</span>
        <span className="text-xs uppercase tracking-widest text-green-400">{title}</span>
      </div>
      <span className="text-[10px] text-gray-600 tracking-widest">{count} ITEMS</span>
    </button>
  )

  return (
    <div className="space-y-2">
      {/* Tools Section */}
      {capabilities.tools.length > 0 && (
        <div>
          <SectionHeader
            title="Tools"
            count={capabilities.tools.length}
            isOpen={expandedSection === 'tools'}
            onClick={() => setExpandedSection(expandedSection === 'tools' ? null : 'tools')}
          />
          {expandedSection === 'tools' && (
            <div className="mt-2 space-y-1 pl-4">
              {capabilities.tools.map(tool => (
                <div key={tool} className="flex items-center justify-between py-1 px-2 hover:bg-black/30 rounded">
                  <span className={`text-xs font-mono ${isEnabled('tool', tool) ? 'text-green-300' : 'text-gray-600 line-through'}`}>
                    {tool}
                  </span>
                  {renderToggle(isEnabled('tool', tool), () => toggleCapability('tool', tool))}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* MCP Servers Section */}
      {capabilities.mcpServers.length > 0 && (
        <div>
          <SectionHeader
            title="MCP Servers"
            count={capabilities.mcpServers.length}
            isOpen={expandedSection === 'mcp'}
            onClick={() => setExpandedSection(expandedSection === 'mcp' ? null : 'mcp')}
          />
          {expandedSection === 'mcp' && (
            <div className="mt-2 space-y-1 pl-4">
              {capabilities.mcpServers.map(server => (
                <div key={server} className="flex items-center justify-between py-1 px-2 hover:bg-black/30 rounded">
                  <span className={`text-xs font-mono ${isEnabled('mcpServer', server) ? 'text-green-300' : 'text-gray-600 line-through'}`}>
                    {server}
                  </span>
                  {renderToggle(isEnabled('mcpServer', server), () => toggleCapability('mcpServer', server))}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Plugins Section */}
      {capabilities.plugins.length > 0 && (
        <div>
          <SectionHeader
            title="Plugins"
            count={capabilities.plugins.length}
            isOpen={expandedSection === 'plugins'}
            onClick={() => setExpandedSection(expandedSection === 'plugins' ? null : 'plugins')}
          />
          {expandedSection === 'plugins' && (
            <div className="mt-2 space-y-1 pl-4">
              {capabilities.plugins.map(plugin => (
                <div key={plugin.id} className="flex items-center justify-between py-1 px-2 hover:bg-black/30 rounded">
                  <div className="flex items-center gap-2">
                    <span className={`text-[9px] px-1 rounded ${
                      plugin.type === 'bundled' ? 'bg-green-900/50 text-green-400' :
                      plugin.type === 'local' ? 'bg-blue-900/50 text-blue-400' :
                      'bg-gray-900/50 text-gray-400'
                    }`}>
                      {plugin.type.toUpperCase()}
                    </span>
                    <span className={`text-xs font-mono ${isEnabled('plugin', plugin.id) ? 'text-green-300' : 'text-gray-600 line-through'}`}>
                      {plugin.id}
                    </span>
                  </div>
                  {renderToggle(isEnabled('plugin', plugin.id), () => toggleCapability('plugin', plugin.id))}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Agents Section */}
      {capabilities.agents.length > 0 && (
        <div>
          <SectionHeader
            title="Custom Agents"
            count={capabilities.agents.length}
            isOpen={expandedSection === 'agents'}
            onClick={() => setExpandedSection(expandedSection === 'agents' ? null : 'agents')}
          />
          {expandedSection === 'agents' && (
            <div className="mt-2 space-y-1 pl-4">
              {capabilities.agents.map(agent => (
                <div key={agent} className="flex items-center justify-between py-1 px-2 hover:bg-black/30 rounded">
                  <span className={`text-xs font-mono ${isEnabled('agent', agent) ? 'text-green-300' : 'text-gray-600 line-through'}`}>
                    {agent}
                  </span>
                  {renderToggle(isEnabled('agent', agent), () => toggleCapability('agent', agent))}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Empty State */}
      {capabilities.tools.length === 0 &&
       capabilities.mcpServers.length === 0 &&
       capabilities.plugins.length === 0 &&
       capabilities.agents.length === 0 && (
        <div className="text-center py-4 text-gray-600 text-xs">
          No capabilities configured in preset
        </div>
      )}

      {/* Override Summary */}
      {overrides.filter(o => !o.enabled).length > 0 && (
        <div className="mt-3 pt-3 border-t border-gray-800">
          <div className="text-[9px] text-amber-600 tracking-widest">
            {overrides.filter(o => !o.enabled).length} CAPABILITY(IES) DISABLED
          </div>
        </div>
      )}
    </div>
  )
}

export default CapabilitiesSelector
