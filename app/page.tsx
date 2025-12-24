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
    <main className="min-h-screen bg-black text-white p-8 font-mono relative">
      <div className="max-w-4xl mx-auto relative z-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-8 border-b border-green-900/30 pb-4">
          <div>
            <h1 className="text-4xl font-bold glow-green tracking-wider">
              <span className="text-green-400">&gt;&gt;</span> POLISH.SYS
            </h1>
            <p className="text-green-600 text-xs mt-1 uppercase tracking-widest">
              [v0.1.0] // Autonomous Code Quality Enhancement
            </p>
          </div>
          {running && (
            <div className="flex items-center gap-3 px-4 py-2 border border-green-500/30 box-glow rounded">
              <span className="text-green-400 blink text-xl">\u25A0</span>
              <div className="flex flex-col">
                <span className="text-green-400 text-sm font-bold uppercase">
                  {currentPhase === 'implement' ? '[ IMPLEMENTING ]' : '[ POLISHING ]'}
                </span>
                <span className="text-green-600 text-xs">SYSTEM ACTIVE</span>
              </div>
            </div>
          )}
        </div>

        {/* Mission Input */}
        {!running && (
          <div className="mb-6 p-5 bg-black rounded border border-green-500/30 box-glow relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-green-400 to-transparent"></div>
            <label className="text-green-400 text-xs block mb-3 uppercase tracking-widest flex items-center gap-2">
              <span>\u25B6</span> Mission Parameters
            </label>
            <textarea
              value={mission}
              onChange={(e) => setMission(e.target.value)}
              placeholder=">> Enter implementation directive... (e.g., Add /api/health endpoint with system metrics)"
              className="w-full bg-black/50 border border-green-800/50 rounded p-3 text-sm text-green-300 placeholder-green-900 resize-none focus:outline-none focus:border-green-400 focus:box-glow font-mono"
              rows={3}
            />
            <div className="flex gap-3 mt-4">
              <button
                onClick={() => startPolish(false)}
                className="px-6 py-2 bg-green-600/20 hover:bg-green-600/30 border border-green-400 text-green-400 rounded font-bold transition-all hover:box-glow uppercase text-sm tracking-wider"
              >
                <span className="mr-2">\u25B6</span>
                {mission.trim() ? 'Execute Mission' : 'Start Polish'}
              </button>
              {mission.trim() && (
                <button
                  onClick={() => startPolish(true)}
                  className="px-6 py-2 bg-cyan-600/20 hover:bg-cyan-600/30 border border-cyan-400 text-cyan-400 rounded font-bold transition-all hover:box-glow-cyan uppercase text-sm tracking-wider"
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
              className="px-6 py-2 bg-red-600/20 hover:bg-red-600/30 border border-red-400 text-red-400 rounded font-bold transition-all uppercase text-sm tracking-wider"
            >
              <span className="mr-2">\u25A0</span>
              Abort Execution
            </button>
          </div>
        )}

        {/* Phase Indicator */}
        {running && (
          <div className="mb-6 flex gap-4">
            <div className={`flex items-center gap-3 px-4 py-2 rounded border ${
              currentPhase === 'implement'
                ? 'bg-magenta-600/10 text-magenta-300 border-magenta-400/50 box-glow-magenta'
                : 'bg-gray-900/30 text-gray-600 border-gray-800'
            }`}>
              <span className={currentPhase === 'implement' ? 'pulse-glow' : ''}>
                {currentPhase === 'implement' ? '\u25B6' : '\u2713'}
              </span>
              <span className="font-bold uppercase text-xs tracking-widest">
                Phase 1: Implement
              </span>
            </div>
            <div className={`flex items-center gap-3 px-4 py-2 rounded border ${
              currentPhase === 'polish'
                ? 'bg-cyan-600/10 text-cyan-300 border-cyan-400/50 box-glow-cyan'
                : 'bg-gray-900/30 text-gray-600 border-gray-800'
            }`}>
              <span className={currentPhase === 'polish' ? 'pulse-glow' : ''}>
                {currentPhase === 'polish' ? '\u25B6' : '\u25CB'}
              </span>
              <span className="font-bold uppercase text-xs tracking-widest">
                Phase 2: Polish
              </span>
            </div>
          </div>
        )}

        {/* Implement Result */}
        {implementResult && (
          <div className="mb-6 p-4 bg-magenta-600/10 rounded border border-magenta-400/50 box-glow-magenta">
            <div className="text-magenta-300 font-bold mb-3 uppercase text-sm tracking-widest flex items-center gap-2">
              <span>\u2713</span> Implementation Complete
            </div>
            <div className="text-sm text-magenta-200/80 space-y-1 font-mono">
              {implementResult.filesCreated.length > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-magenta-500">+</span>
                  Created: {implementResult.filesCreated.length} files
                </div>
              )}
              {implementResult.filesModified.length > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-magenta-500">~</span>
                  Modified: {implementResult.filesModified.length} files
                </div>
              )}
              <div className="text-xs text-magenta-500 mt-2 flex items-center gap-2">
                <span>\u25A0</span>
                Commit: {implementResult.commitHash.slice(0, 7)}
              </div>
            </div>
          </div>
        )}

        {/* Score Section */}
        {score !== null && (
          <div className="mb-8 p-5 bg-black rounded border border-cyan-500/30 box-glow-cyan relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-cyan-400 to-transparent"></div>
            <div className="text-cyan-400 text-xs mb-3 uppercase tracking-widest flex items-center gap-2">
              <span>\u25C6</span> Quality Score
            </div>
            <ScoreBar score={score} initialScore={initialScore ?? undefined} />
          </div>
        )}

        {/* Metrics Grid */}
        {metrics.length > 0 && (
          <div className="mb-8 p-5 bg-black rounded border border-green-500/30 box-glow relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-green-400 to-transparent"></div>
            <div className="text-green-400 text-xs mb-4 uppercase tracking-widest flex items-center gap-2">
              <span>\u25C6</span> System Metrics
            </div>
            <MetricsGrid metrics={metrics} currentStrategy={currentStrategy ?? undefined} />
          </div>
        )}

        {/* Commits Timeline */}
        {commits.length > 0 && (
          <div className="mb-8 p-5 bg-black rounded border border-yellow-500/30 relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-yellow-400 to-transparent"></div>
            <CommitTimeline commits={commits} />
          </div>
        )}

        {/* Agent Log */}
        {events.length > 0 && (
          <div className="mb-8 p-5 bg-black rounded border border-blue-500/30 relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-blue-400 to-transparent"></div>
            <div className="text-blue-400 text-xs mb-4 uppercase tracking-widest flex items-center gap-2">
              <span>\u25C6</span> Agent Activity Log
            </div>
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
