'use client'

import { useState, useRef } from 'react'
import { ScoreBar } from './components/ScoreBar'
import { MetricsGrid } from './components/MetricCard'
import { CommitTimeline } from './components/CommitTimeline'
import { EventLog } from './components/EventLog'
import type { MetricResult } from '@/lib/types'

interface PolishEvent {
  type: string
  data: {
    phase?: string
    message?: string
    tool?: string
    input?: unknown
    output?: unknown
    score?: number
    metrics?: MetricResult[]
    delta?: number
    hash?: string
    scoreDelta?: number
    iteration?: number
    name?: string
    focus?: string
    prompt?: string
    reason?: string
    failedStrategy?: string
    success?: boolean
    initialScore?: number
    finalScore?: number
    commits?: Array<{
      hash: string
      message: string
      scoreDelta: number
    }>
    iterations?: number
    cost?: number
    duration?: number
    stoppedReason?: string
    projectPath?: string
    preset?: string
    [key: string]: unknown
  }
  timestamp: Date
}

export default function Home() {
  const [running, setRunning] = useState(false)
  const [events, setEvents] = useState<PolishEvent[]>([])
  const [score, setScore] = useState<number | null>(null)
  const [initialScore, setInitialScore] = useState<number | null>(null)
  const [metrics, setMetrics] = useState<MetricResult[]>([])
  const [commits, setCommits] = useState<Array<{
    hash: string
    message: string
    scoreDelta: number
  }>>([])
  const [currentStrategy, setCurrentStrategy] = useState<string | null>(null)
  const [result, setResult] = useState<{
    success: boolean
    duration: number
    iterations: number
    stoppedReason?: string
  } | null>(null)
  const [mission, setMission] = useState('')
  const [currentPhase, setCurrentPhase] = useState<'idle' | 'implement' | 'polish'>('idle')
  const [implementResult, setImplementResult] = useState<{
    filesCreated: string[]
    filesModified: string[]
    commitHash: string
  } | null>(null)

  const abortRef = useRef<AbortController | null>(null)

  const startPolish = async (polishOnly = false) => {
    setRunning(true)
    setEvents([])
    setScore(null)
    setInitialScore(null)
    setMetrics([])
    setCommits([])
    setCurrentStrategy(null)
    setResult(null)
    setCurrentPhase(polishOnly || !mission.trim() ? 'polish' : 'implement')
    setImplementResult(null)
    abortRef.current = new AbortController()

    try {
      const res = await fetch('/api/polish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mission: mission.trim() || undefined,
          polishOnly,
          maxDuration: 5 * 60 * 1000 // 5 minutes
        }),
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

              // Handle different event types
              if (currentEventType === 'phase') {
                setCurrentPhase(data.phase as 'implement' | 'polish')
              } else if (currentEventType === 'implement_done') {
                setImplementResult({
                  filesCreated: data.filesCreated || [],
                  filesModified: data.filesModified || [],
                  commitHash: data.commitHash || ''
                })
                setCurrentPhase('polish')
              } else if (currentEventType === 'init') {
                setInitialScore(data.initialScore)
                setScore(data.initialScore)
                if (data.metrics) setMetrics(data.metrics)
              } else if (currentEventType === 'score') {
                setScore(data.score)
                if (data.metrics) setMetrics(data.metrics)
              } else if (currentEventType === 'strategy') {
                setCurrentStrategy(data.focus)
              } else if (currentEventType === 'commit') {
                setCommits(prev => [...prev, {
                  hash: data.hash,
                  message: data.message,
                  scoreDelta: data.scoreDelta
                }])
                setCurrentStrategy(null)
              } else if (currentEventType === 'rollback') {
                setCurrentStrategy(null)
              } else if (currentEventType === 'result') {
                setResult({
                  success: data.success,
                  duration: data.duration,
                  iterations: data.iterations,
                  stoppedReason: data.stoppedReason
                })
                if (data.finalScore) setScore(data.finalScore)
                setCurrentPhase('idle')
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

  return (
    <main className="min-h-screen bg-gray-950 text-white p-8 font-mono">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold">POLISH</h1>
            <p className="text-gray-500 text-sm">Automated code quality improvement</p>
          </div>
          {running && (
            <span className="flex items-center gap-2 text-green-400">
              <span className="animate-pulse">{'\u25A0'}</span>
              {currentPhase === 'implement' ? 'Implementing...' : 'Polishing...'}
            </span>
          )}
        </div>

        {/* Mission Input */}
        {!running && (
          <div className="mb-6 p-4 bg-gray-900 rounded-lg border border-gray-800">
            <label className="text-gray-500 text-sm block mb-2">
              Mission (optional)
            </label>
            <textarea
              value={mission}
              onChange={(e) => setMission(e.target.value)}
              placeholder="Describe what you want to implement... e.g., Add a /api/health endpoint that returns status and uptime"
              className="w-full bg-gray-950 border border-gray-700 rounded p-3 text-sm text-white placeholder-gray-600 resize-none focus:outline-none focus:border-blue-500"
              rows={3}
            />
            <div className="flex gap-3 mt-4">
              <button
                onClick={() => startPolish(false)}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 rounded font-medium transition-colors"
              >
                {mission.trim() ? 'Implement & Polish' : 'Start Polish'}
              </button>
              {mission.trim() && (
                <button
                  onClick={() => startPolish(true)}
                  className="px-6 py-2 bg-gray-700 hover:bg-gray-600 rounded font-medium transition-colors"
                >
                  Polish Only
                </button>
              )}
            </div>
          </div>
        )}

        {/* Running Controls */}
        {running && (
          <div className="mb-6">
            <button
              onClick={stopPolish}
              className="px-6 py-2 bg-red-600 hover:bg-red-700 rounded font-medium transition-colors"
            >
              Stop
            </button>
          </div>
        )}

        {/* Phase Indicator */}
        {running && (
          <div className="mb-6 flex gap-4">
            <div className={`flex items-center gap-2 px-3 py-1 rounded ${
              currentPhase === 'implement' ? 'bg-purple-900/50 text-purple-300' : 'bg-gray-800 text-gray-500'
            }`}>
              <span>{currentPhase === 'implement' ? '\u25B6' : '\u2713'}</span>
              Phase 1: Implement
            </div>
            <div className={`flex items-center gap-2 px-3 py-1 rounded ${
              currentPhase === 'polish' ? 'bg-blue-900/50 text-blue-300' : 'bg-gray-800 text-gray-500'
            }`}>
              <span>{currentPhase === 'polish' ? '\u25B6' : '\u25CB'}</span>
              Phase 2: Polish
            </div>
          </div>
        )}

        {/* Implement Result */}
        {implementResult && (
          <div className="mb-6 p-4 bg-purple-900/20 rounded-lg border border-purple-800">
            <div className="text-purple-300 font-medium mb-2">Implementation Complete</div>
            <div className="text-sm text-gray-400">
              {implementResult.filesCreated.length > 0 && (
                <div>Created: {implementResult.filesCreated.length} files</div>
              )}
              {implementResult.filesModified.length > 0 && (
                <div>Modified: {implementResult.filesModified.length} files</div>
              )}
              <div className="text-xs text-gray-500 mt-1">
                Commit: {implementResult.commitHash.slice(0, 7)}
              </div>
            </div>
          </div>
        )}

        {/* Score Section */}
        {score !== null && (
          <div className="mb-8 p-4 bg-gray-900 rounded-lg border border-gray-800">
            <div className="text-gray-500 text-sm mb-2">Score</div>
            <ScoreBar score={score} initialScore={initialScore ?? undefined} />
          </div>
        )}

        {/* Metrics Grid */}
        {metrics.length > 0 && (
          <div className="mb-8 p-4 bg-gray-900 rounded-lg border border-gray-800">
            <div className="text-gray-500 text-sm mb-3">Metrics</div>
            <MetricsGrid metrics={metrics} currentStrategy={currentStrategy ?? undefined} />
          </div>
        )}

        {/* Commits Timeline */}
        {commits.length > 0 && (
          <div className="mb-8 p-4 bg-gray-900 rounded-lg border border-gray-800">
            <CommitTimeline commits={commits} />
          </div>
        )}

        {/* Agent Log */}
        {events.length > 0 && (
          <div className="mb-8 p-4 bg-gray-900 rounded-lg border border-gray-800">
            <div className="text-gray-500 text-sm mb-3">Agent Activity</div>
            <EventLog events={events} />
          </div>
        )}

        {/* Result */}
        {result && (
          <div className={`p-4 rounded-lg border ${
            result.success
              ? 'bg-green-900/30 border-green-800'
              : 'bg-yellow-900/30 border-yellow-800'
          }`}>
            <div className={`font-medium ${
              result.success ? 'text-green-400' : 'text-yellow-400'
            }`}>
              {result.success ? 'Polish Complete!' : 'Polish Stopped'}
            </div>
            <div className="text-sm text-gray-400 mt-1">
              {result.iterations} iterations |{' '}
              {(result.duration / 1000).toFixed(1)}s
              {result.stoppedReason && ` | ${result.stoppedReason}`}
            </div>
            {initialScore !== null && score !== null && (
              <div className="text-sm text-gray-300 mt-2">
                Score: {initialScore.toFixed(0)} \u2192 {score.toFixed(0)}{' '}
                <span className={score > initialScore ? 'text-green-400' : 'text-gray-500'}>
                  ({score > initialScore ? '+' : ''}{(score - initialScore).toFixed(1)} pts)
                </span>
              </div>
            )}
          </div>
        )}

        {/* Empty State - only show when not running and no events and no result */}
        {!running && events.length === 0 && !result && (
          <div className="text-center py-8 text-gray-600">
            <p className="text-sm">Enter a mission to implement new features, or start Polish to improve existing code</p>
          </div>
        )}

        {/* Loading State */}
        {running && events.length === 0 && (
          <div className="text-center py-16 text-gray-500">
            <div className="animate-pulse text-2xl mb-4">...</div>
            <p>Starting polish agent...</p>
          </div>
        )}
      </div>
    </main>
  )
}
