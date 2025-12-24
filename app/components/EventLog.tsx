'use client'

import { useEffect, useRef } from 'react'

interface AgentEvent {
  type: string
  data: {
    phase?: string
    message?: string
    tool?: string
    input?: unknown
    output?: unknown
    [key: string]: unknown
  }
  timestamp?: Date
}

interface EventLogProps {
  events: AgentEvent[]
  maxDisplay?: number
}

export function EventLog({ events, maxDisplay = 20 }: EventLogProps) {
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [events])

  // Filter to only show agent-related events
  const agentEvents = events
    .filter(e => e.type === 'agent' || e.type === 'status')
    .slice(-maxDisplay)

  if (agentEvents.length === 0) {
    return (
      <div className="text-gray-600 font-mono text-sm">
        Waiting for agent activity...
      </div>
    )
  }

  const getIcon = (event: AgentEvent) => {
    if (event.data.tool) {
      return event.data.phase === 'PreToolUse' ? '▸' : '✓'
    }
    if (event.type === 'status') return '►'
    return '●'
  }

  const getColor = (event: AgentEvent) => {
    if (event.data.tool) {
      if (event.data.phase === 'PreToolUse') return 'text-cyan-400'
      return 'text-green-600'
    }
    if (event.type === 'status') return 'text-yellow-400'
    return 'text-gray-400'
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

  const formatEvent = (event: AgentEvent) => {
    if (event.data.tool) {
      const tool = event.data.tool
      if (event.data.phase === 'PreToolUse') {
        const input = typeof event.data.input === 'string'
          ? event.data.input.slice(0, 60)
          : JSON.stringify(event.data.input).slice(0, 60)
        return `${tool.toUpperCase()}(${input}${input.length >= 60 ? '...' : ''})`
      } else {
        const output = typeof event.data.output === 'string'
          ? event.data.output.slice(0, 80)
          : JSON.stringify(event.data.output).slice(0, 80)
        return `${tool.toUpperCase()} → ${output}${output.length >= 80 ? '...' : ''}`
      }
    }

    if (event.data.message) {
      return event.data.message.slice(0, 180)
    }

    return JSON.stringify(event.data).slice(0, 100)
  }

  return (
    <div className="font-mono text-xs space-y-0.5 max-h-64 overflow-y-auto hex-pattern p-2 rounded">
      {agentEvents.map((event, i) => (
        <div key={i} className={`${getColor(event)} flex gap-2 items-start p-1.5 rounded hover:bg-gray-900/30 transition-colors border-l-2 ${
          event.data.tool && event.data.phase === 'PreToolUse'
            ? 'border-cyan-600/50'
            : event.data.tool
            ? 'border-green-600/30'
            : 'border-gray-800/50'
        }`}>
          <span className="text-gray-700 text-[9px] w-20 flex-shrink-0 tracking-wider">
            {formatTimestamp(event)}
          </span>
          <span className="flex-shrink-0">{getIcon(event)}</span>
          <span className="break-all flex-1 leading-tight">{formatEvent(event)}</span>
        </div>
      ))}
      <div ref={endRef} />
    </div>
  )
}

export default EventLog
