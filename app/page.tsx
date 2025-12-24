'use client'

import { useState, useRef, useEffect } from 'react'

interface PolishEvent {
  type: string
  data: {
    phase?: string
    message?: string
    tool?: string
    input?: unknown
    output?: unknown
    success?: boolean
    turns?: number
    cost?: number
    duration?: number
    sessionId?: string
    [key: string]: unknown
  }
  timestamp: Date
}

export default function Home() {
  const [repoUrl, setRepoUrl] = useState('')
  const [maxTurns, setMaxTurns] = useState(20)
  const [events, setEvents] = useState<PolishEvent[]>([])
  const [running, setRunning] = useState(false)
  const [stats, setStats] = useState<{
    turns?: number
    cost?: number
    duration?: number
    success?: boolean
  } | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const eventsEndRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom when new events arrive
  useEffect(() => {
    eventsEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [events])

  const startPolish = async () => {
    setRunning(true)
    setEvents([])
    setStats(null)
    abortRef.current = new AbortController()

    try {
      const res = await fetch('/api/polish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repoUrl, maxTurns }),
        signal: abortRef.current.signal
      })

      if (!res.ok) {
        const errorData = await res.json()
        throw new Error(errorData.error || 'Failed to start polish')
      }

      const reader = res.body!.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        let currentEventType = ''
        for (const line of lines) {
          if (line.startsWith('event: ')) {
            currentEventType = line.slice(7)
          } else if (line.startsWith('data: ') && currentEventType) {
            try {
              const data = JSON.parse(line.slice(6))
              const event: PolishEvent = {
                type: currentEventType,
                data,
                timestamp: new Date()
              }

              setEvents(prev => [...prev, event])

              if (currentEventType === 'result') {
                setStats({
                  turns: data.turns,
                  cost: data.cost,
                  duration: data.duration,
                  success: data.success
                })
              }
            } catch {
              // Ignore JSON parse errors
            }
            currentEventType = ''
          }
        }
      }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        setEvents(prev => [
          ...prev,
          {
            type: 'error',
            data: { message: (err as Error).message },
            timestamp: new Date()
          }
        ])
      }
    } finally {
      setRunning(false)
    }
  }

  const stopPolish = () => {
    abortRef.current?.abort()
  }

  const getEventIcon = (type: string) => {
    switch (type) {
      case 'status':
        return '>'
      case 'tool':
        return '#'
      case 'assistant':
        return '*'
      case 'result':
        return '='
      case 'error':
        return '!'
      default:
        return '-'
    }
  }

  const getEventColor = (type: string) => {
    switch (type) {
      case 'error':
        return 'bg-red-900/50 border-red-800'
      case 'tool':
        return 'bg-blue-900/30 border-blue-800'
      case 'result':
        return 'bg-green-900/30 border-green-800'
      case 'assistant':
        return 'bg-purple-900/30 border-purple-800'
      default:
        return 'bg-gray-900 border-gray-800'
    }
  }

  const formatEventData = (event: PolishEvent) => {
    const { type, data } = event

    if (type === 'status') {
      return data.message || JSON.stringify(data)
    }

    if (type === 'tool') {
      const phase = data.phase === 'PreToolUse' ? 'calling' : 'returned'
      const toolName = data.tool || 'unknown'
      if (phase === 'calling') {
        return `${toolName}: ${JSON.stringify(data.input, null, 2).slice(0, 200)}`
      } else {
        const output = typeof data.output === 'string'
          ? data.output.slice(0, 300)
          : JSON.stringify(data.output, null, 2).slice(0, 300)
        return `${toolName} -> ${output}${output.length >= 300 ? '...' : ''}`
      }
    }

    if (type === 'assistant') {
      return data.message || ''
    }

    if (type === 'result') {
      return `${data.success ? 'Success' : 'Stopped'} - ${data.turns} turns, $${data.cost?.toFixed(4) || '0'}`
    }

    if (type === 'error') {
      return data.message || 'Unknown error'
    }

    return JSON.stringify(data, null, 2).slice(0, 500)
  }

  return (
    <main className="min-h-screen bg-gray-950 text-white p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold mb-2">Polish</h1>
        <p className="text-gray-400 mb-8">
          Automated code quality improvement via Claude Agent SDK
        </p>

        <div className="space-y-4 mb-8">
          <div>
            <label htmlFor="repoUrl" className="block text-sm font-medium mb-2">
              GitHub Repository URL
            </label>
            <input
              type="url"
              id="repoUrl"
              value={repoUrl}
              onChange={e => setRepoUrl(e.target.value)}
              placeholder="https://github.com/user/repo"
              disabled={running}
              className="w-full px-4 py-3 bg-gray-900 border border-gray-800 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none disabled:opacity-50"
            />
          </div>

          <div className="flex gap-4 items-end">
            <div className="flex-1">
              <label htmlFor="maxTurns" className="block text-sm font-medium mb-2">
                Max turns: {maxTurns}
              </label>
              <input
                type="range"
                id="maxTurns"
                min={5}
                max={50}
                step={5}
                value={maxTurns}
                onChange={e => setMaxTurns(Number(e.target.value))}
                disabled={running}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>5</span>
                <span>25</span>
                <span>50</span>
              </div>
            </div>

            <button
              onClick={running ? stopPolish : startPolish}
              disabled={!repoUrl && !running}
              className={`px-6 py-3 rounded-lg font-medium transition-colors ${
                running
                  ? 'bg-red-600 hover:bg-red-700'
                  : 'bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:cursor-not-allowed'
              }`}
            >
              {running ? 'Stop' : 'Start Polish'}
            </button>
          </div>
        </div>

        {stats && (
          <div
            className={`mb-6 p-4 rounded-lg border ${
              stats.success
                ? 'bg-green-900/30 border-green-800'
                : 'bg-yellow-900/30 border-yellow-800'
            }`}
          >
            <div
              className={`font-medium ${
                stats.success ? 'text-green-400' : 'text-yellow-400'
              }`}
            >
              {stats.success ? 'Complete!' : 'Stopped'}
            </div>
            <div className="text-sm text-gray-300 mt-1">
              {stats.turns} turns | ${stats.cost?.toFixed(4) || '0'} USD |{' '}
              {stats.duration ? `${(stats.duration / 1000).toFixed(1)}s` : '-'}
            </div>
          </div>
        )}

        {events.length > 0 && (
          <div className="space-y-2 max-h-[60vh] overflow-auto rounded-lg border border-gray-800 p-4 bg-gray-900/50">
            {events.map((event, i) => (
              <div
                key={i}
                className={`p-3 rounded border text-sm ${getEventColor(event.type)}`}
              >
                <div className="flex items-start gap-2">
                  <span className="text-gray-500 font-mono">
                    {getEventIcon(event.type)}
                  </span>
                  <div className="flex-1 min-w-0">
                    <span className="text-gray-400 text-xs uppercase">
                      {event.type}
                      {event.data.phase && event.type === 'tool' && (
                        <span className="ml-2 text-gray-600">
                          {event.data.phase === 'PreToolUse' ? 'call' : 'result'}
                        </span>
                      )}
                    </span>
                    <pre className="mt-1 text-xs whitespace-pre-wrap break-all font-mono">
                      {formatEventData(event)}
                    </pre>
                  </div>
                  <span className="text-gray-600 text-xs">
                    {event.timestamp.toLocaleTimeString()}
                  </span>
                </div>
              </div>
            ))}
            <div ref={eventsEndRef} />
          </div>
        )}

        {running && events.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            <div className="animate-pulse">Starting agent...</div>
          </div>
        )}
      </div>
    </main>
  )
}
