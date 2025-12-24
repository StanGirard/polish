'use client'

import { useState, useRef } from 'react'
import { ScoreBar } from './components/ScoreBar'
import { MetricsGrid } from './components/MetricCard'
import { CommitTimeline } from './components/CommitTimeline'
import { EventLog } from './components/EventLog'
import { SystemMonitor } from './components/SystemMonitor'
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
      {/* System Monitor - Fixed Position */}
      <SystemMonitor
        running={running}
        phase={currentPhase}
        eventsCount={events.length}
        commitsCount={commits.length}
      />

      <div className="max-w-5xl mx-auto relative z-10">
        {/* Header */}
        <div className="mb-8 border border-green-900/30 rounded bg-black/50 p-5 box-glow relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-green-400 to-transparent"></div>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-5xl font-bold glow-green tracking-wider mb-2">
                <span className="text-green-400">&gt;&gt;</span> POLISH.RUN
              </h1>
              <div className="flex items-center gap-4 text-[10px] text-green-700 uppercase tracking-widest">
                <span>[v0.1.0]</span>
                <span className="text-gray-800">|</span>
                <span>Autonomous Code Quality Enhancement Protocol</span>
              </div>
              <div className="mt-2 text-[9px] text-gray-700 tracking-widest font-bold">
                █▓▒░ LLM-DRIVEN OPTIMIZATION ENGINE ░▒▓█
              </div>
            </div>
            {running && (
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-3 px-4 py-2 border border-green-500/30 box-glow rounded bg-green-950/20">
                  <span className="text-green-400 blink text-xl">\u25A0</span>
                  <div className="flex flex-col">
                    <span className="text-green-400 text-sm font-bold uppercase tracking-wider">
                      {currentPhase === 'implement' ? '[ IMPLEMENTING ]' : '[ POLISHING ]'}
                    </span>
                    <span className="text-green-600 text-[10px] tracking-widest">SYSTEM ACTIVE</span>
                  </div>
                </div>
              </div>
            )}
            {!running && (
              <div className="text-[10px] text-gray-700 tracking-widest space-y-1 text-right">
                <div>SYSTEM: <span className="text-gray-600">STANDBY</span></div>
                <div>READY: <span className="text-green-700">TRUE</span></div>
                <div>MODE: <span className="text-green-700">INTERACTIVE</span></div>
              </div>
            )}
          </div>
        </div>

        {/* Mission Input */}
        {!running && (
          <div className="mb-6 p-5 bg-black rounded border border-green-500/30 box-glow relative overflow-hidden data-stream">
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-green-400 to-transparent"></div>
            <label className="text-green-400 text-xs block mb-3 uppercase tracking-widest flex items-center gap-2">
              <span>\u25B6</span> Mission Parameters
              <span className="text-gray-800">|</span>
              <span className="text-gray-700 text-[9px]">INPUT DIRECTIVE</span>
            </label>
            <div className="relative">
              <textarea
                value={mission}
                onChange={(e) => setMission(e.target.value)}
                placeholder=">> Enter implementation directive... (e.g., Add /api/health endpoint with system metrics)"
                className="w-full bg-black/50 border border-green-800/50 rounded p-3 text-sm text-green-300 placeholder-green-900 resize-none focus:outline-none focus:border-green-400 focus:box-glow font-mono leading-relaxed"
                rows={3}
              />
              <div className="absolute bottom-2 right-2 text-[9px] text-gray-800 tracking-widest">
                {mission.length} CHARS
              </div>
            </div>
            <div className="flex gap-3 mt-4">
              <button
                onClick={() => startPolish(false)}
                className="px-6 py-3 bg-green-600/20 hover:bg-green-600/30 border border-green-400 text-green-400 rounded font-bold transition-all hover:box-glow uppercase text-sm tracking-wider flex items-center gap-2 group"
              >
                <span className="group-hover:animate-pulse">\u25B6</span>
                <span>{mission.trim() ? 'Execute Mission' : 'Start Polish'}</span>
                <span className="text-[9px] text-green-700">[ ENTER ]</span>
              </button>
              {mission.trim() && (
                <button
                  onClick={() => startPolish(true)}
                  className="px-6 py-3 bg-cyan-600/20 hover:bg-cyan-600/30 border border-cyan-400 text-cyan-400 rounded font-bold transition-all hover:box-glow-cyan uppercase text-sm tracking-wider flex items-center gap-2"
                >
                  <span>◆</span>
                  <span>Polish Only</span>
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
              className="px-6 py-3 bg-red-600/20 hover:bg-red-600/30 border border-red-400 text-red-400 rounded font-bold transition-all uppercase text-sm tracking-wider flex items-center gap-2 hover:shadow-[0_0_20px_rgba(255,0,0,0.3)] group"
            >
              <span className="group-hover:animate-pulse">\u25A0</span>
              <span>Abort Execution</span>
              <span className="text-[9px] text-red-700">[ ESC ]</span>
            </button>
          </div>
        )}

        {/* Phase Indicator */}
        {running && (
          <div className="mb-6 flex gap-4">
            <div className={`flex-1 flex items-center gap-3 px-5 py-3 rounded border relative overflow-hidden ${
              currentPhase === 'implement'
                ? 'bg-magenta-600/10 text-magenta-300 border-magenta-400/50 box-glow-magenta data-stream'
                : 'bg-gray-900/30 text-gray-600 border-gray-800'
            }`}>
              <span className={`text-2xl ${currentPhase === 'implement' ? 'pulse-glow blink' : ''}`}>
                {currentPhase === 'implement' ? '\u25B6' : '\u2713'}
              </span>
              <div className="flex flex-col">
                <span className="font-bold uppercase text-sm tracking-widest">
                  Phase 1: Implement
                </span>
                <span className="text-[9px] tracking-widest opacity-60">
                  {currentPhase === 'implement' ? 'ACTIVE' : 'COMPLETE'}
                </span>
              </div>
              {currentPhase === 'implement' && (
                <div className="ml-auto text-[9px] text-magenta-600 tracking-widest">
                  0x01
                </div>
              )}
            </div>
            <div className={`flex-1 flex items-center gap-3 px-5 py-3 rounded border relative overflow-hidden ${
              currentPhase === 'polish'
                ? 'bg-cyan-600/10 text-cyan-300 border-cyan-400/50 box-glow-cyan data-stream'
                : 'bg-gray-900/30 text-gray-600 border-gray-800'
            }`}>
              <span className={`text-2xl ${currentPhase === 'polish' ? 'pulse-glow blink' : ''}`}>
                {currentPhase === 'polish' ? '\u25B6' : '\u25CB'}
              </span>
              <div className="flex flex-col">
                <span className="font-bold uppercase text-sm tracking-widest">
                  Phase 2: Polish
                </span>
                <span className="text-[9px] tracking-widest opacity-60">
                  {currentPhase === 'polish' ? 'ACTIVE' : 'PENDING'}
                </span>
              </div>
              {currentPhase === 'polish' && (
                <div className="ml-auto text-[9px] text-cyan-600 tracking-widest">
                  0x02
                </div>
              )}
            </div>
          </div>
        )}

        {/* Implement Result */}
        {implementResult && (
          <div className="mb-6 p-5 bg-magenta-600/10 rounded border border-magenta-400/50 box-glow-magenta relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-magenta-400 to-transparent"></div>
            <div className="text-magenta-300 font-bold mb-4 uppercase text-sm tracking-widest flex items-center gap-2">
              <span>\u2713</span> Implementation Complete
              <span className="text-gray-800">|</span>
              <span className="text-magenta-700 text-[9px]">PHASE 1 RESULT</span>
            </div>
            <div className="grid grid-cols-2 gap-4 text-xs font-mono">
              {implementResult.filesCreated.length > 0 && (
                <div className="p-3 bg-black/30 rounded border border-magenta-900/50">
                  <div className="flex items-center gap-2 text-magenta-400 mb-2">
                    <span className="text-lg">+</span>
                    <span className="font-bold uppercase tracking-wider">Created</span>
                  </div>
                  <div className="text-magenta-200 text-xl font-bold">
                    {implementResult.filesCreated.length}
                    <span className="text-xs text-magenta-700 ml-1">FILES</span>
                  </div>
                </div>
              )}
              {implementResult.filesModified.length > 0 && (
                <div className="p-3 bg-black/30 rounded border border-magenta-900/50">
                  <div className="flex items-center gap-2 text-magenta-400 mb-2">
                    <span className="text-lg">~</span>
                    <span className="font-bold uppercase tracking-wider">Modified</span>
                  </div>
                  <div className="text-magenta-200 text-xl font-bold">
                    {implementResult.filesModified.length}
                    <span className="text-xs text-magenta-700 ml-1">FILES</span>
                  </div>
                </div>
              )}
            </div>
            <div className="mt-4 p-2 bg-black/50 rounded border border-magenta-900/30 flex items-center justify-between">
              <div className="flex items-center gap-2 text-[10px] text-magenta-600 tracking-widest">
                <span>\u25A0</span>
                <span>COMMIT HASH</span>
              </div>
              <div className="text-magenta-400 font-bold tracking-wider">
                #{implementResult.commitHash.slice(0, 7)}
                <span className="text-magenta-700 ml-2 text-[9px]">
                  0x{parseInt(implementResult.commitHash.slice(0, 6), 16).toString(16).toUpperCase().padStart(6, '0')}
                </span>
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
          <div className={`mb-8 p-5 rounded border relative overflow-hidden ${
            result.success
              ? 'bg-green-900/20 border-green-600/50 box-glow'
              : 'bg-yellow-900/20 border-yellow-600/50'
          }`}>
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-current to-transparent"></div>
            <div className="flex items-center justify-between mb-4">
              <div className={`text-xl font-bold uppercase tracking-widest flex items-center gap-3 ${
                result.success ? 'text-green-400' : 'text-yellow-400'
              }`}>
                <span className="text-3xl">{result.success ? '✓' : '■'}</span>
                <span>{result.success ? 'Execution Complete' : 'Execution Stopped'}</span>
              </div>
              <div className="text-[9px] text-gray-700 tracking-widest">
                {result.stoppedReason?.toUpperCase() || 'FINISHED'}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4 font-mono text-xs">
              <div className="p-3 bg-black/30 rounded border border-gray-800">
                <div className="text-gray-600 uppercase tracking-wider mb-1 text-[10px]">Iterations</div>
                <div className="text-2xl font-bold text-white">
                  {result.iterations}
                  <span className="text-xs text-gray-600 ml-1">CYCLES</span>
                </div>
              </div>

              <div className="p-3 bg-black/30 rounded border border-gray-800">
                <div className="text-gray-600 uppercase tracking-wider mb-1 text-[10px]">Duration</div>
                <div className="text-2xl font-bold text-white">
                  {(result.duration / 1000).toFixed(1)}
                  <span className="text-xs text-gray-600 ml-1">SEC</span>
                </div>
              </div>

              {initialScore !== null && score !== null && (
                <div className="p-3 bg-black/30 rounded border border-gray-800">
                  <div className="text-gray-600 uppercase tracking-wider mb-1 text-[10px]">Score Delta</div>
                  <div className={`text-2xl font-bold ${score > initialScore ? 'text-green-400' : 'text-gray-500'}`}>
                    {score > initialScore ? '▲' : '▼'} {Math.abs(score - initialScore).toFixed(1)}
                    <span className="text-xs text-gray-600 ml-1">PTS</span>
                  </div>
                </div>
              )}
            </div>

            {initialScore !== null && score !== null && (
              <div className="mt-4 p-3 bg-black/50 rounded border border-gray-800/50 flex items-center justify-between">
                <span className="text-gray-500 text-xs uppercase tracking-widest">Quality Score Evolution</span>
                <div className="flex items-center gap-3 font-mono">
                  <span className="text-gray-400">{initialScore.toFixed(0)}</span>
                  <span className="text-gray-700">→</span>
                  <span className={`font-bold ${score > initialScore ? 'text-green-400' : 'text-gray-400'}`}>
                    {score.toFixed(0)}
                  </span>
                  <span className="text-[9px] text-gray-700 tracking-widest">
                    [0x{Math.round(initialScore).toString(16).toUpperCase().padStart(2, '0')} → 0x{Math.round(score).toString(16).toUpperCase().padStart(2, '0')}]
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Empty State - only show when not running and no events and no result */}
        {!running && events.length === 0 && !result && (
          <div className="text-center py-16 border border-gray-900 rounded bg-black/30 hex-pattern">
            <div className="text-gray-700 text-6xl mb-4">◆</div>
            <div className="text-gray-600 text-sm font-mono uppercase tracking-widest mb-2">
              System Ready
            </div>
            <p className="text-gray-700 text-xs tracking-wider">
              Enter a mission to implement new features, or start Polish to improve existing code
            </p>
            <div className="mt-6 flex items-center justify-center gap-4 text-[10px] text-gray-800 tracking-widest">
              <span>STATUS: IDLE</span>
              <span>|</span>
              <span>MODE: STANDBY</span>
              <span>|</span>
              <span>READY: TRUE</span>
            </div>
          </div>
        )}

        {/* Loading State */}
        {running && events.length === 0 && (
          <div className="text-center py-16 border border-green-900/30 rounded bg-black/30 box-glow data-stream">
            <div className="text-green-400 text-4xl mb-6 animate-pulse">▬▬▬</div>
            <div className="text-green-400 text-sm font-mono uppercase tracking-widest mb-2">
              Initializing Agent
            </div>
            <p className="text-green-700 text-xs tracking-wider">Loading system modules...</p>
            <div className="mt-6 flex items-center justify-center gap-2 text-[10px] text-green-800 tracking-widest">
              <span className="blink">●</span>
              <span>BOOTSTRAPPING RUNTIME</span>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="mt-12 pt-6 border-t border-green-900/30">
          <div className="flex items-center justify-between text-[10px] text-gray-700 tracking-widest font-mono">
            <div className="flex items-center gap-4">
              <span>POLISH.RUN</span>
              <span className="text-gray-800">|</span>
              <span>BUILD: {new Date().toISOString().split('T')[0].replace(/-/g, '')}</span>
              <span className="text-gray-800">|</span>
              <span className="text-green-800">ANTHROPIC CLAUDE SDK</span>
            </div>
            <div className="flex items-center gap-4">
              <span>KERNEL: v0.1.0</span>
              <span className="text-gray-800">|</span>
              <span>NODE: {typeof process !== 'undefined' ? 'ACTIVE' : 'N/A'}</span>
            </div>
          </div>
          <div className="mt-2 text-center text-[8px] text-gray-800 tracking-widest">
            █▓▒░ AUTONOMOUS CODE QUALITY ENHANCEMENT PROTOCOL ░▒▓█
          </div>
        </div>
      </div>
    </main>
  )
}
