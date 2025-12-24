'use client'

import { useEffect, useRef, useState } from 'react'

// Sub-agent type configuration
const SUB_AGENT_CONFIG: Record<string, { icon: string; color: string; borderColor: string; bgColor: string }> = {
  'Explore': { icon: '🔍', color: 'text-cyan-400', borderColor: 'border-cyan-600/50', bgColor: 'bg-cyan-900/10' },
  'Plan': { icon: '📋', color: 'text-purple-400', borderColor: 'border-purple-600/50', bgColor: 'bg-purple-900/10' },
  'research': { icon: '📚', color: 'text-blue-400', borderColor: 'border-blue-600/50', bgColor: 'bg-blue-900/10' },
  'code-analysis': { icon: '🔬', color: 'text-green-400', borderColor: 'border-green-600/50', bgColor: 'bg-green-900/10' },
  'security-review': { icon: '🔒', color: 'text-red-400', borderColor: 'border-red-600/50', bgColor: 'bg-red-900/10' },
  'test-analysis': { icon: '🧪', color: 'text-yellow-400', borderColor: 'border-yellow-600/50', bgColor: 'bg-yellow-900/10' },
}

interface AgentEvent {
  type: string
  data: {
    phase?: string
    message?: string
    tool?: string
    input?: unknown
    output?: unknown
    subAgentType?: string
    [key: string]: unknown
  }
  timestamp?: Date
}

interface EventLogProps {
  events: AgentEvent[]
  maxDisplay?: number
}

export function EventLog({ events, maxDisplay = 30 }: EventLogProps) {
  const endRef = useRef<HTMLDivElement>(null)
  const [expandedEvents, setExpandedEvents] = useState<Set<number>>(new Set())

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [events])

  // Filter to only show agent-related events and result
  const agentEvents = events
    .filter(e => e.type === 'agent' || e.type === 'status' || e.type === 'result')
    .slice(-maxDisplay)

  if (agentEvents.length === 0) {
    return (
      <div className="text-gray-600 font-mono text-sm">
        Waiting for agent activity...
      </div>
    )
  }

  const toggleExpand = (index: number) => {
    setExpandedEvents(prev => {
      const next = new Set(prev)
      if (next.has(index)) {
        next.delete(index)
      } else {
        next.add(index)
      }
      return next
    })
  }

  const isSubAgentEvent = (event: AgentEvent): boolean => {
    return event.data.tool === 'Task' && !!event.data.subAgentType
  }

  const getSubAgentConfig = (type: string | undefined) => {
    if (!type) return null
    return SUB_AGENT_CONFIG[type] || {
      icon: '🤖',
      color: 'text-gray-400',
      borderColor: 'border-gray-600/50',
      bgColor: 'bg-gray-900/10'
    }
  }

  const getIcon = (event: AgentEvent) => {
    // Sub-agent icons
    if (isSubAgentEvent(event)) {
      const config = getSubAgentConfig(event.data.subAgentType)
      if (config) return config.icon
    }

    if (event.data.tool) {
      return event.data.phase === 'PreToolUse' ? '▸' : '✓'
    }
    if (event.type === 'result') {
      return event.data.success ? '✓' : '■'
    }
    if (event.type === 'status') return '►'
    return '●'
  }

  const getColor = (event: AgentEvent) => {
    // Sub-agent colors
    if (isSubAgentEvent(event)) {
      const config = getSubAgentConfig(event.data.subAgentType)
      if (config) return config.color
    }

    if (event.data.tool) {
      if (event.data.phase === 'PreToolUse') return 'text-cyan-400'
      return 'text-green-600'
    }
    if (event.type === 'result') {
      return event.data.success ? 'text-green-400' : 'text-orange-400'
    }
    if (event.type === 'status') return 'text-yellow-400'
    return 'text-gray-400'
  }

  const getBorderClass = (event: AgentEvent) => {
    // Sub-agent border colors
    if (isSubAgentEvent(event)) {
      const config = getSubAgentConfig(event.data.subAgentType)
      if (config) {
        return `${config.borderColor} ${config.bgColor}`
      }
    }

    if (event.type === 'result') {
      return event.data.success
        ? 'border-green-400/70 bg-green-900/10'
        : 'border-orange-400/70 bg-orange-900/10'
    }
    if (event.data.tool && event.data.phase === 'PreToolUse') {
      return 'border-cyan-600/50'
    }
    if (event.data.tool) {
      return 'border-green-600/30'
    }
    return 'border-gray-800/50'
  }

  const formatTimestamp = (event: AgentEvent) => {
    if (!event.timestamp) return ''
    const date = new Date(event.timestamp)
    const h = date.getHours().toString().padStart(2, '0')
    const m = date.getMinutes().toString().padStart(2, '0')
    const s = date.getSeconds().toString().padStart(2, '0')
    const ms = date.getMilliseconds().toString().padStart(3, '0')
    return `${h}:${m}:${s}.${ms}`
  }

  const formatStoppedReason = (reason: string | undefined): string => {
    switch (reason) {
      case 'max_score': return 'Target score reached'
      case 'timeout': return 'Timeout'
      case 'plateau': return 'No more improvements possible'
      case 'max_iterations': return 'Max iterations reached'
      default: return reason || 'Unknown'
    }
  }

  const formatEvent = (event: AgentEvent, isExpanded: boolean) => {
    // Special formatting for sub-agents
    if (isSubAgentEvent(event)) {
      const subAgentType = event.data.subAgentType
      const input = event.data.input as { prompt?: string } | undefined
      const prompt = input?.prompt || ''

      if (event.data.phase === 'PreToolUse') {
        const truncatedPrompt = prompt.slice(0, isExpanded ? 500 : 80)
        return (
          <span>
            <span className="font-semibold uppercase">{subAgentType}</span>
            <span className="text-gray-500 ml-2">
              {truncatedPrompt}
              {prompt.length > (isExpanded ? 500 : 80) && '...'}
            </span>
          </span>
        )
      } else {
        const output = event.data.output
        const outputStr = typeof output === 'string'
          ? output
          : JSON.stringify(output)
        const truncatedOutput = outputStr.slice(0, isExpanded ? 1000 : 100)
        return (
          <span>
            <span className="font-semibold uppercase">{subAgentType}</span>
            <span className="text-gray-400 ml-2">→</span>
            <span className="text-gray-500 ml-2">
              {truncatedOutput}
              {outputStr.length > (isExpanded ? 1000 : 100) && '...'}
            </span>
          </span>
        )
      }
    }

    // Regular tool events
    if (event.data.tool) {
      const tool = event.data.tool
      if (event.data.phase === 'PreToolUse') {
        const input = typeof event.data.input === 'string'
          ? event.data.input
          : JSON.stringify(event.data.input)
        const maxLen = isExpanded ? 500 : 60
        return `${tool.toUpperCase()}(${input.slice(0, maxLen)}${input.length > maxLen ? '...' : ''})`
      } else {
        const output = typeof event.data.output === 'string'
          ? event.data.output
          : JSON.stringify(event.data.output)
        const maxLen = isExpanded ? 800 : 80
        return `${tool.toUpperCase()} → ${output.slice(0, maxLen)}${output.length > maxLen ? '...' : ''}`
      }
    }

    if (event.type === 'result') {
      const reason = formatStoppedReason(event.data.stoppedReason as string)
      const success = event.data.success ? 'SUCCESS' : 'STOPPED'
      return `${success}: ${reason} | Score: ${event.data.initialScore} → ${event.data.finalScore}`
    }

    if (event.data.message) {
      return event.data.message.slice(0, isExpanded ? 500 : 180)
    }

    return JSON.stringify(event.data).slice(0, isExpanded ? 500 : 100)
  }

  const hasExpandableContent = (event: AgentEvent): boolean => {
    if (isSubAgentEvent(event)) return true
    if (event.data.tool) {
      const content = event.data.phase === 'PreToolUse'
        ? (typeof event.data.input === 'string' ? event.data.input : JSON.stringify(event.data.input))
        : (typeof event.data.output === 'string' ? event.data.output : JSON.stringify(event.data.output))
      return content.length > 100
    }
    return false
  }

  return (
    <div className="font-mono text-xs space-y-0.5 max-h-80 overflow-y-auto hex-pattern p-2 rounded">
      {agentEvents.map((event, i) => {
        const isExpanded = expandedEvents.has(i)
        const isSubAgent = isSubAgentEvent(event)
        const canExpand = hasExpandableContent(event)

        return (
          <div
            key={i}
            className={`${getColor(event)} flex gap-2 items-start p-1.5 rounded hover:bg-gray-900/30 transition-colors border-l-2 ${getBorderClass(event)} ${
              canExpand ? 'cursor-pointer' : ''
            }`}
            onClick={() => canExpand && toggleExpand(i)}
          >
            <span className="text-gray-700 text-[9px] w-20 flex-shrink-0 tracking-wider">
              {formatTimestamp(event)}
            </span>
            <span className={`flex-shrink-0 ${isSubAgent ? 'text-base' : ''}`}>
              {getIcon(event)}
            </span>
            <span className={`break-all flex-1 leading-tight ${isExpanded ? 'whitespace-pre-wrap' : ''}`}>
              {formatEvent(event, isExpanded)}
            </span>
            {canExpand && (
              <span className="text-gray-600 text-[9px] flex-shrink-0">
                {isExpanded ? '▼' : '▶'}
              </span>
            )}
            {isSubAgent && event.data.phase === 'PreToolUse' && (
              <span className="animate-pulse text-[9px] flex-shrink-0">●</span>
            )}
          </div>
        )
      })}
      <div ref={endRef} />
    </div>
  )
}

export default EventLog
