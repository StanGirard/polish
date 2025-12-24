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
      return event.data.phase === 'PreToolUse' ? '#' : '='
    }
    if (event.type === 'status') return '>'
    return '*'
  }

  const getColor = (event: AgentEvent) => {
    if (event.data.tool) return 'text-blue-400'
    if (event.type === 'status') return 'text-yellow-400'
    return 'text-gray-300'
  }

  const formatEvent = (event: AgentEvent) => {
    if (event.data.tool) {
      const tool = event.data.tool
      if (event.data.phase === 'PreToolUse') {
        const input = typeof event.data.input === 'string'
          ? event.data.input.slice(0, 80)
          : JSON.stringify(event.data.input).slice(0, 80)
        return `${tool} ${input}${input.length >= 80 ? '...' : ''}`
      } else {
        const output = typeof event.data.output === 'string'
          ? event.data.output.slice(0, 100)
          : JSON.stringify(event.data.output).slice(0, 100)
        return `${tool} -> ${output}${output.length >= 100 ? '...' : ''}`
      }
    }

    if (event.data.message) {
      return event.data.message.slice(0, 200)
    }

    return JSON.stringify(event.data).slice(0, 100)
  }

  return (
    <div className="font-mono text-xs space-y-1 max-h-48 overflow-y-auto">
      {agentEvents.map((event, i) => (
        <div key={i} className={`${getColor(event)} flex gap-2`}>
          <span className="text-gray-600">{getIcon(event)}</span>
          <span className="break-all">{formatEvent(event)}</span>
        </div>
      ))}
      <div ref={endRef} />
    </div>
  )
}

export default EventLog
