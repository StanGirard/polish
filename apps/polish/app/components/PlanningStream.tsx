'use client'

import { useState } from 'react'

// Sub-agent type icons and colors
const SUB_AGENT_CONFIG: Record<string, { icon: string; color: string; bgColor: string; borderColor: string }> = {
  'Explore': { icon: '🔍', color: 'text-cyan-400', bgColor: 'bg-cyan-900/20', borderColor: 'border-cyan-800/30' },
  'Plan': { icon: '📋', color: 'text-purple-400', bgColor: 'bg-purple-900/20', borderColor: 'border-purple-800/30' },
  'research': { icon: '📚', color: 'text-blue-400', bgColor: 'bg-blue-900/20', borderColor: 'border-blue-800/30' },
  'code-analysis': { icon: '🔬', color: 'text-green-400', bgColor: 'bg-green-900/20', borderColor: 'border-green-800/30' },
  'security-review': { icon: '🔒', color: 'text-red-400', bgColor: 'bg-red-900/20', borderColor: 'border-red-800/30' },
  'test-analysis': { icon: '🧪', color: 'text-yellow-400', bgColor: 'bg-yellow-900/20', borderColor: 'border-yellow-800/30' },
}

export interface SubAgentThinking {
  id: string
  type: string
  prompt: string
  thinkingText: string
  streamingText: string
  output?: string
  isComplete: boolean
  isExpanded: boolean
  startedAt: Date
  completedAt?: Date
}

interface PlanningStreamProps {
  streamingText: string
  thinkingText: string
  isStreaming: boolean
  subAgents?: SubAgentThinking[]
  onToggleSubAgent?: (id: string) => void
}

export function PlanningStream({
  streamingText,
  thinkingText,
  isStreaming,
  subAgents = [],
  onToggleSubAgent
}: PlanningStreamProps) {
  const [isMainThinkingExpanded, setIsMainThinkingExpanded] = useState(false)

  const getSubAgentConfig = (type: string) => {
    return SUB_AGENT_CONFIG[type] || {
      icon: '🤖',
      color: 'text-gray-400',
      bgColor: 'bg-gray-900/20',
      borderColor: 'border-gray-800/30'
    }
  }

  return (
    <div className="space-y-4">
      {/* Main Thinking Toggle (Ultrathink mode) */}
      {thinkingText && (
        <div>
          <button
            onClick={() => setIsMainThinkingExpanded(!isMainThinkingExpanded)}
            className="flex items-center gap-2 text-purple-400 text-xs uppercase tracking-widest hover:text-purple-300 transition-colors"
          >
            <span>{isMainThinkingExpanded ? '▼' : '▶'}</span>
            <span>Extended Thinking</span>
            <span className="text-purple-600 text-[10px]">({thinkingText.length.toLocaleString()} chars)</span>
            {isStreaming && <span className="animate-pulse text-purple-300">●</span>}
          </button>
          {isMainThinkingExpanded && (
            <div className="mt-2 p-3 bg-purple-900/20 rounded border border-purple-800/30 max-h-64 overflow-y-auto">
              <pre className="text-purple-300 text-xs whitespace-pre-wrap font-mono leading-relaxed">
                {thinkingText}
                {isStreaming && <span className="text-purple-400 animate-pulse">▋</span>}
              </pre>
            </div>
          )}
        </div>
      )}

      {/* Sub-Agents Section */}
      {subAgents.length > 0 && (
        <div className="space-y-2">
          <div className="text-gray-500 text-xs uppercase tracking-widest">Sub-Agents</div>
          {subAgents.map(agent => {
            const config = getSubAgentConfig(agent.type)
            return (
              <div
                key={agent.id}
                className={`rounded border ${config.borderColor} ${config.bgColor} overflow-hidden`}
              >
                {/* Sub-agent header */}
                <button
                  onClick={() => onToggleSubAgent?.(agent.id)}
                  className={`w-full flex items-center gap-2 p-2 ${config.color} text-xs hover:bg-black/20 transition-colors`}
                >
                  <span>{agent.isExpanded ? '▼' : '▶'}</span>
                  <span className="text-lg">{config.icon}</span>
                  <span className="uppercase tracking-widest font-medium">{agent.type}</span>
                  {!agent.isComplete && (
                    <span className="animate-pulse ml-auto">●</span>
                  )}
                  {agent.isComplete && (
                    <span className="text-green-500 ml-auto">✓</span>
                  )}
                  {agent.thinkingText && (
                    <span className="text-gray-600 text-[10px]">
                      (thinking: {agent.thinkingText.length.toLocaleString()})
                    </span>
                  )}
                </button>

                {/* Sub-agent content (expanded) */}
                {agent.isExpanded && (
                  <div className="border-t border-gray-800/50 p-3 space-y-2">
                    {/* Prompt */}
                    <div>
                      <div className="text-gray-600 text-[10px] uppercase tracking-widest mb-1">Prompt</div>
                      <div className="text-gray-400 text-xs max-h-20 overflow-y-auto">
                        {agent.prompt.slice(0, 300)}
                        {agent.prompt.length > 300 && '...'}
                      </div>
                    </div>

                    {/* Thinking (if available) */}
                    {agent.thinkingText && (
                      <div>
                        <div className="text-purple-600 text-[10px] uppercase tracking-widest mb-1">Thinking</div>
                        <div className="p-2 bg-purple-900/30 rounded max-h-32 overflow-y-auto">
                          <pre className="text-purple-300 text-[10px] whitespace-pre-wrap font-mono">
                            {agent.thinkingText}
                            {!agent.isComplete && <span className="text-purple-400 animate-pulse">▋</span>}
                          </pre>
                        </div>
                      </div>
                    )}

                    {/* Streaming output */}
                    {agent.streamingText && (
                      <div>
                        <div className="text-gray-600 text-[10px] uppercase tracking-widest mb-1">Output</div>
                        <div className="p-2 bg-gray-900/50 rounded max-h-32 overflow-y-auto">
                          <pre className="text-gray-300 text-[10px] whitespace-pre-wrap font-mono">
                            {agent.streamingText}
                            {!agent.isComplete && <span className={`${config.color} animate-pulse`}>▋</span>}
                          </pre>
                        </div>
                      </div>
                    )}

                    {/* Completion time */}
                    {agent.isComplete && agent.completedAt && agent.startedAt && (
                      <div className="text-gray-600 text-[10px]">
                        Completed in {((agent.completedAt.getTime() - agent.startedAt.getTime()) / 1000).toFixed(1)}s
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Main Streaming Text */}
      {streamingText && (
        <div className="p-3 bg-gray-900/50 rounded border border-gray-800 max-h-96 overflow-y-auto">
          <pre className="text-gray-300 text-sm whitespace-pre-wrap font-mono leading-relaxed">
            {streamingText}
            {isStreaming && <span className="text-orange-400 animate-pulse">▋</span>}
          </pre>
        </div>
      )}

      {/* Empty state while waiting for first chunk */}
      {!streamingText && !thinkingText && subAgents.length === 0 && isStreaming && (
        <div className="flex items-center gap-3 text-gray-500 text-sm">
          <span className="animate-spin">⟳</span>
          <span>Analyzing codebase...</span>
        </div>
      )}
    </div>
  )
}

export default PlanningStream
