'use client'

import { useState, useEffect, useRef } from 'react'
import { ScoreBar } from './ScoreBar'
import { MetricsGrid } from './MetricCard'
import { CommitTimeline } from './CommitTimeline'
import { EventLog } from './EventLog'
import { FeedbackPanel } from './FeedbackPanel'
import type { Session } from '@/lib/session-store'
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
    branchName?: string
    kept?: boolean
    worktreePath?: string
    baseBranch?: string
    [key: string]: unknown
  }
  timestamp: Date
}

interface SessionDetailProps {
  session: Session
  onClose: () => void
  onCreatePR: () => void
  onRetry?: (sessionId: string, feedback: string) => Promise<void>
  onFeedbackSubmit?: (sessionId: string, rating: 'satisfied' | 'unsatisfied', comment?: string) => Promise<void>
}

export function SessionDetail({ session, onClose, onCreatePR, onRetry, onFeedbackSubmit }: SessionDetailProps) {
  const [events, setEvents] = useState<PolishEvent[]>([])
  const [score, setScore] = useState<number | null>(session.finalScore ?? session.initialScore ?? null)
  const [initialScore, setInitialScore] = useState<number | null>(session.initialScore ?? null)
  const [metrics, setMetrics] = useState<MetricResult[]>([])
  const [commits, setCommits] = useState<Array<{
    hash: string
    message: string
    scoreDelta: number
  }>>([])
  const [currentStrategy, setCurrentStrategy] = useState<string | null>(null)
  const [currentPhase, setCurrentPhase] = useState<'idle' | 'implement' | 'polish'>(
    session.status === 'running' ? 'polish' : 'idle'
  )
  const eventSourceRef = useRef<EventSource | null>(null)

  // Subscribe to SSE stream
  useEffect(() => {
    const eventSource = new EventSource(`/api/sessions/${session.id}/stream`)
    eventSourceRef.current = eventSource

    eventSource.onmessage = (event) => {
      // Handle generic messages if needed
    }

    // Handle specific event types
    const eventTypes = [
      'init', 'phase', 'implement_done', 'score', 'strategy',
      'agent', 'commit', 'rollback', 'result', 'error', 'status',
      'worktree_created', 'worktree_cleanup', 'session_status', 'done'
    ]

    for (const type of eventTypes) {
      eventSource.addEventListener(type, (e) => {
        try {
          const data = JSON.parse((e as MessageEvent).data)
          const polishEvent: PolishEvent = {
            type,
            data,
            timestamp: new Date()
          }

          if (type === 'session_status') {
            // Initial status update
            if (data.initialScore) setInitialScore(data.initialScore)
            if (data.finalScore) setScore(data.finalScore)
            return
          }

          if (type === 'done') {
            eventSource.close()
            return
          }

          setEvents(prev => [...prev, polishEvent])

          // Update state based on event type
          if (type === 'init') {
            setInitialScore(data.initialScore)
            setScore(data.initialScore)
            if (data.metrics) setMetrics(data.metrics)
          }

          if (type === 'phase') {
            setCurrentPhase(data.phase as 'implement' | 'polish')
          }

          if (type === 'score') {
            setScore(data.score)
            if (data.metrics) setMetrics(data.metrics)
          }

          if (type === 'strategy') {
            setCurrentStrategy(data.focus)
          }

          if (type === 'commit') {
            setCommits(prev => [...prev, {
              hash: data.hash,
              message: data.message,
              scoreDelta: data.scoreDelta
            }])
            setCurrentStrategy(null)
          }

          if (type === 'rollback') {
            setCurrentStrategy(null)
          }

          if (type === 'result') {
            setCurrentPhase('idle')
            if (data.finalScore) setScore(data.finalScore)
          }
        } catch {
          // Ignore parse errors
        }
      })
    }

    eventSource.onerror = () => {
      eventSource.close()
    }

    return () => {
      eventSource.close()
    }
  }, [session.id])

  const shortId = session.id.slice(-6)

  return (
    <div className="fixed inset-0 z-50 bg-black/90 overflow-y-auto">
      <div className="max-w-5xl mx-auto p-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6 pb-4 border-b border-green-900/30">
          <div className="flex items-center gap-4">
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-green-400 transition-colors"
            >
              ← BACK
            </button>
            <div>
              <h2 className="text-xl font-bold text-green-400 glow-green">
                SESSION #{shortId}
              </h2>
              <div className="text-[10px] text-gray-600 tracking-widest">
                {session.mission || 'POLISH ONLY'}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {session.status === 'running' && (
              <span className="text-green-400 text-sm blink">● RUNNING</span>
            )}
            {session.status === 'completed' && session.branchName && (
              <button
                onClick={onCreatePR}
                className="px-4 py-2 text-sm text-purple-400 border border-purple-800 rounded hover:bg-purple-900/30 transition-colors"
              >
                ⬆ CREATE PR
              </button>
            )}
          </div>
        </div>

        {/* Phase Indicator (when running) */}
        {session.status === 'running' && (
          <div className="mb-6 flex gap-4">
            <PhaseIndicator
              label="Phase 1: Implement"
              active={currentPhase === 'implement'}
              complete={currentPhase === 'polish'}
              code="0x01"
            />
            <PhaseIndicator
              label="Phase 2: Polish"
              active={currentPhase === 'polish'}
              complete={false}
              code="0x02"
            />
          </div>
        )}

        {/* Feedback Panel (when completed/failed with mission) */}
        {['completed', 'failed'].includes(session.status) && session.mission && onRetry && onFeedbackSubmit && (
          <div className="mb-6">
            <FeedbackPanel
              session={session}
              onRetry={async (feedback) => {
                await onRetry(session.id, feedback)
              }}
              onFeedbackSubmit={async (rating, comment) => {
                await onFeedbackSubmit(session.id, rating, comment)
              }}
            />
          </div>
        )}

        {/* Score */}
        {score !== null && (
          <div className="mb-6 p-5 bg-black rounded border border-cyan-500/30 box-glow-cyan relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-cyan-400 to-transparent" />
            <div className="text-cyan-400 text-xs mb-3 uppercase tracking-widest flex items-center gap-2">
              <span>◆</span> Quality Score
            </div>
            <ScoreBar score={score} initialScore={initialScore ?? undefined} />
          </div>
        )}

        {/* Metrics Grid */}
        {metrics.length > 0 && (
          <div className="mb-6 p-5 bg-black rounded border border-green-500/30 box-glow relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-green-400 to-transparent" />
            <div className="text-green-400 text-xs mb-4 uppercase tracking-widest flex items-center gap-2">
              <span>◆</span> System Metrics
            </div>
            <MetricsGrid metrics={metrics} currentStrategy={currentStrategy ?? undefined} />
          </div>
        )}

        {/* Commits */}
        {commits.length > 0 && (
          <div className="mb-6 p-5 bg-black rounded border border-yellow-500/30 relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-yellow-400 to-transparent" />
            <CommitTimeline commits={commits} />
          </div>
        )}

        {/* Event Log */}
        {events.length > 0 && (
          <div className="mb-6 p-5 bg-black rounded border border-blue-500/30 relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-blue-400 to-transparent" />
            <div className="text-blue-400 text-xs mb-4 uppercase tracking-widest flex items-center gap-2">
              <span>◆</span> Agent Activity Log
            </div>
            <EventLog events={events} />
          </div>
        )}

        {/* Empty state */}
        {events.length === 0 && session.status !== 'running' && (
          <div className="text-center py-12 border border-gray-800 rounded bg-black/30">
            <div className="text-gray-700 text-4xl mb-2">◇</div>
            <div className="text-gray-600 text-xs tracking-widest">
              NO EVENTS RECORDED
            </div>
          </div>
        )}

        {/* Loading */}
        {events.length === 0 && session.status === 'running' && (
          <div className="text-center py-12 border border-green-900/30 rounded bg-black/30 box-glow data-stream">
            <div className="text-green-400 text-4xl mb-6 animate-pulse">▬▬▬</div>
            <div className="text-green-400 text-sm font-mono uppercase tracking-widest mb-2">
              Connecting to Session
            </div>
            <p className="text-green-700 text-xs tracking-wider">Loading events...</p>
          </div>
        )}
      </div>
    </div>
  )
}

function PhaseIndicator({
  label,
  active,
  complete,
  code
}: {
  label: string
  active: boolean
  complete: boolean
  code: string
}) {
  return (
    <div className={`
      flex-1 flex items-center gap-3 px-5 py-3 rounded border relative overflow-hidden
      ${active
        ? 'bg-green-600/10 text-green-300 border-green-400/50 box-glow data-stream'
        : complete
          ? 'bg-gray-900/30 text-gray-400 border-gray-800'
          : 'bg-gray-900/30 text-gray-600 border-gray-800'
      }
    `}>
      <span className={`text-2xl ${active ? 'pulse-glow blink' : ''}`}>
        {active ? '▶' : complete ? '✓' : '○'}
      </span>
      <div className="flex flex-col">
        <span className="font-bold uppercase text-sm tracking-widest">
          {label}
        </span>
        <span className="text-[9px] tracking-widest opacity-60">
          {active ? 'ACTIVE' : complete ? 'COMPLETE' : 'PENDING'}
        </span>
      </div>
      {active && (
        <div className="ml-auto text-[9px] text-green-600 tracking-widest">
          {code}
        </div>
      )}
    </div>
  )
}

export default SessionDetail
