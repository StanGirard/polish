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

// Extract relevant info from tool input for concise display
const extractToolSummary = (tool: string, input: unknown): string => {
  const data = typeof input === 'object' && input !== null ? input as Record<string, unknown> : {}

  switch (tool.toLowerCase()) {
    case 'bash': {
      const cmd = data.command as string || ''
      // Truncate long commands
      return cmd.length > 80 ? cmd.slice(0, 77) + '...' : cmd
    }
    case 'read': {
      const filePath = data.file_path as string || ''
      // Show just filename for short paths, or last 2 segments for context
      const parts = filePath.split('/')
      return parts.length > 2 ? parts.slice(-2).join('/') : parts.pop() || filePath
    }
    case 'write': {
      const writePath = data.file_path as string || ''
      const parts = writePath.split('/')
      return parts.length > 2 ? parts.slice(-2).join('/') : parts.pop() || writePath
    }
    case 'edit': {
      const editPath = data.file_path as string || ''
      const parts = editPath.split('/')
      return parts.length > 2 ? parts.slice(-2).join('/') : parts.pop() || editPath
    }
    case 'glob': {
      return data.pattern as string || ''
    }
    case 'grep': {
      const pattern = data.pattern as string || ''
      const path = data.path as string || ''
      const pathPart = path ? path.split('/').pop() || '' : ''
      return `"${pattern.slice(0, 30)}"${pathPart ? ` in ${pathPart}` : ''}`
    }
    case 'task': {
      const subType = data.subAgentType as string || ''
      const desc = data.description as string || ''
      return subType || desc || 'agent'
    }
    default: {
      const str = JSON.stringify(input)
      return str.length > 50 ? str.slice(0, 47) + '...' : str
    }
  }
}

// Extract summary from tool output for concise display
const extractOutputSummary = (tool: string, output: unknown): string => {
  const data = typeof output === 'object' && output !== null ? output as Record<string, unknown> : {}

  switch (tool.toLowerCase()) {
    case 'bash': {
      const stderr = data.stderr as string || ''
      if (stderr && stderr.trim()) {
        return `err: ${stderr.trim().slice(0, 40)}...`
      }
      const stdout = data.stdout as string || ''
      if (!stdout || !stdout.trim()) return '(empty)'
      const lines = stdout.split('\n').filter(l => l.trim()).length
      return `${lines} line${lines !== 1 ? 's' : ''}`
    }
    case 'read': {
      const file = data.file as Record<string, unknown> | undefined
      const content = file?.content as string || ''
      if (!content) return '(read)'
      const lines = content.split('\n').length
      return `${lines} line${lines !== 1 ? 's' : ''}`
    }
    case 'glob': {
      const filenames = data.filenames as string[] || []
      return `${filenames.length} file${filenames.length !== 1 ? 's' : ''}`
    }
    case 'grep': {
      // Grep might return files_with_matches or content
      if (Array.isArray(data)) {
        return `${data.length} match${data.length !== 1 ? 'es' : ''}`
      }
      const str = JSON.stringify(output)
      return str.length > 30 ? str.slice(0, 27) + '...' : str
    }
    case 'edit':
    case 'write': {
      return 'done'
    }
    case 'task': {
      const str = typeof output === 'string' ? output : JSON.stringify(output)
      return str.length > 50 ? str.slice(0, 47) + '...' : str
    }
    default: {
      const str = typeof output === 'string' ? output : JSON.stringify(output)
      return str.length > 50 ? str.slice(0, 47) + '...' : str
    }
  }
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
  showStats?: boolean
}

interface ToolStats {
  totalCalls: number
  toolCounts: Record<string, number>
  averageDuration: number
  subAgentCalls: number
}

export function EventLog({ events, maxDisplay = 30, showStats = true }: EventLogProps) {
  const endRef = useRef<HTMLDivElement>(null)
  const [expandedEvents, setExpandedEvents] = useState<Set<number>>(new Set())
  const [showStatsPanel, setShowStatsPanel] = useState(false)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [events])

  // Calculate tool call statistics
  const calculateStats = (): ToolStats => {
    const toolEvents = events.filter(e => e.type === 'agent' && e.data.tool)
    const stats: ToolStats = {
      totalCalls: 0,
      toolCounts: {},
      averageDuration: 0,
      subAgentCalls: 0
    }

    const durations: number[] = []
    const seenCalls = new Set<string>()

    for (const event of toolEvents) {
      // Count only PostToolUse to avoid double counting
      if (event.data.phase === 'PostToolUse') {
        const key = `${event.data.tool}-${event.timestamp?.getTime() || Date.now()}`
        if (!seenCalls.has(key)) {
          stats.totalCalls++
          seenCalls.add(key)

          // Count by tool
          const tool = event.data.tool as string
          stats.toolCounts[tool] = (stats.toolCounts[tool] || 0) + 1

          // Track sub-agent calls
          if (event.data.subAgentType) {
            stats.subAgentCalls++
          }
        }
      }
    }

    // Calculate average duration (mock for now, would need timing data)
    if (durations.length > 0) {
      stats.averageDuration = durations.reduce((a, b) => a + b, 0) / durations.length
    }

    return stats
  }

  const stats = calculateStats()

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

    // Progress indicator for in-progress tools
    if (event.data.phase === 'InProgress') return '⟳'

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

    // Progress events get a distinct yellow color
    if (event.data.phase === 'InProgress') return 'text-yellow-400'

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

    // Progress events get a yellow border with subtle background
    if (event.data.phase === 'InProgress') {
      return 'border-yellow-600/50 bg-yellow-900/10'
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

    // Progress events (InProgress phase)
    if (event.data.phase === 'InProgress') {
      const tool = event.data.tool || 'Tool'
      const elapsed = event.data.elapsedTime as number | undefined
      const elapsedStr = elapsed != null ? ` (${elapsed.toFixed(1)}s)` : ''
      return (
        <span className="animate-pulse">
          <span className="font-semibold">{tool.toUpperCase()}</span>
          <span className="text-yellow-500 ml-2">running...{elapsedStr}</span>
        </span>
      )
    }

    // Regular tool events - concise display with expand option
    if (event.data.tool) {
      const tool = event.data.tool

      if (event.data.phase === 'PreToolUse') {
        const summary = extractToolSummary(tool, event.data.input)

        if (isExpanded) {
          // Show full JSON when expanded
          const fullInput = JSON.stringify(event.data.input, null, 2)
          return (
            <div className="space-y-1">
              <div>
                <span className="font-semibold text-cyan-400">{tool}</span>
                <span className="text-gray-500 ml-1">: {summary}</span>
              </div>
              <pre className="text-[10px] text-gray-600 bg-gray-900/50 p-2 rounded overflow-x-auto max-h-40">
                {fullInput}
              </pre>
            </div>
          )
        }

        return (
          <span>
            <span className="font-semibold text-cyan-400">{tool}</span>
            <span className="text-gray-500 ml-1">: {summary}</span>
          </span>
        )
      } else {
        // PostToolUse - show result summary
        const inputSummary = extractToolSummary(tool, event.data.input)
        const outputSummary = extractOutputSummary(tool, event.data.output)

        if (isExpanded) {
          // Show full JSON when expanded
          const fullOutput = JSON.stringify(event.data.output, null, 2)
          const truncatedOutput = fullOutput.length > 2000 ? fullOutput.slice(0, 2000) + '\n...(truncated)' : fullOutput
          return (
            <div className="space-y-1">
              <div>
                <span className="font-semibold text-green-500">{tool}</span>
                <span className="text-gray-500 ml-1">: {inputSummary}</span>
                <span className="text-gray-400 mx-2">→</span>
                <span className="text-green-600">{outputSummary}</span>
              </div>
              <pre className="text-[10px] text-gray-600 bg-gray-900/50 p-2 rounded overflow-x-auto max-h-40">
                {truncatedOutput}
              </pre>
            </div>
          )
        }

        return (
          <span>
            <span className="font-semibold text-green-500">{tool}</span>
            <span className="text-gray-500 ml-1">: {inputSummary}</span>
            <span className="text-gray-400 mx-2">→</span>
            <span className="text-green-600">{outputSummary}</span>
          </span>
        )
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
    <div className="space-y-2">
      {/* Statistics Header */}
      {showStats && stats.totalCalls > 0 && (
        <div className="flex items-center justify-between px-2 py-1 bg-gray-900/50 rounded border border-gray-800/50">
          <div className="flex items-center gap-4 text-[10px] text-gray-400 font-mono">
            <span title="Total tool calls completed">
              🔧 <span className="text-gray-300">{stats.totalCalls}</span> calls
            </span>
            {stats.subAgentCalls > 0 && (
              <span title="Sub-agent invocations">
                🤖 <span className="text-cyan-400">{stats.subAgentCalls}</span> agents
              </span>
            )}
            {Object.keys(stats.toolCounts).length > 0 && (
              <span title="Most used tool">
                ⚡ <span className="text-yellow-400">
                  {Object.entries(stats.toolCounts).sort((a, b) => b[1] - a[1])[0][0]}
                </span>
              </span>
            )}
          </div>
          <button
            onClick={() => setShowStatsPanel(!showStatsPanel)}
            className="text-[10px] text-gray-500 hover:text-gray-300 transition-colors"
            title="Toggle detailed statistics"
          >
            {showStatsPanel ? '▼' : '▶'} Stats
          </button>
        </div>
      )}

      {/* Detailed Statistics Panel */}
      {showStatsPanel && stats.totalCalls > 0 && (
        <div className="px-3 py-2 bg-gray-900/30 rounded border border-gray-800/50 font-mono text-[10px]">
          <div className="text-gray-400 font-semibold mb-2">📊 Tool Call Statistics</div>
          <div className="space-y-1">
            <div className="flex justify-between">
              <span className="text-gray-500">Total calls:</span>
              <span className="text-gray-300">{stats.totalCalls}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Sub-agents:</span>
              <span className="text-cyan-400">{stats.subAgentCalls}</span>
            </div>
            <div className="border-t border-gray-800/50 my-2"></div>
            <div className="text-gray-500 mb-1">By tool:</div>
            {Object.entries(stats.toolCounts)
              .sort((a, b) => b[1] - a[1])
              .map(([tool, count]) => (
                <div key={tool} className="flex justify-between pl-2">
                  <span className="text-gray-400">{tool}:</span>
                  <span className="text-gray-300">{count}</span>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Event Log */}
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
    </div>
  )
}

export default EventLog
