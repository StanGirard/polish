'use client'

import { useState, useEffect, useRef } from 'react'
import { ScoreBar } from './ScoreBar'
import { MetricsGrid } from './MetricCard'
import { CommitTimeline } from './CommitTimeline'
import { EventLog } from './EventLog'
import { FeedbackPanel } from './FeedbackPanel'
import { FileChangesSection } from './FileChangesSection'
import {
  handleEventNotification,
  getNotificationsEnabled,
  requestNotificationPermission
} from '@/app/lib/notifications'
import type { Session } from '@/lib/session-store'
import type { MetricResult, PlanStep } from '@/lib/types'

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
    // Planning phase fields
    plan?: PlanStep[]
    summary?: string
    estimatedChanges?: {
      filesCreated: string[]
      filesModified: string[]
      filesDeleted: string[]
    }
    risks?: string[]
    questions?: string[]
    approvedAt?: string
    rejectedAt?: string
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
  // Planning phase callbacks
  onApprovePlan?: (sessionId: string, plan?: PlanStep[]) => Promise<void>
  onRejectPlan?: (sessionId: string, reason?: string) => Promise<void>
  onSendPlanMessage?: (sessionId: string, message: string) => Promise<void>
  onAbortSession?: (sessionId: string) => Promise<void>
}

export function SessionDetail({
  session,
  onClose,
  onCreatePR,
  onRetry,
  onFeedbackSubmit,
  onApprovePlan,
  onRejectPlan,
  onSendPlanMessage,
  onAbortSession
}: SessionDetailProps) {
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
  const [currentPhase, setCurrentPhase] = useState<'idle' | 'planning' | 'implement' | 'polish'>(
    session.status === 'planning' ? 'planning' :
    session.status === 'awaiting_approval' ? 'planning' :
    session.status === 'running' ? 'polish' : 'idle'
  )
  const [currentPlan, setCurrentPlan] = useState<PlanStep[] | null>(session.approvedPlan || null)
  const [planSummary, setPlanSummary] = useState<string | null>(null)
  const [planRisks, setPlanRisks] = useState<string[]>([])
  const [notificationsEnabled, setNotificationsEnabled] = useState(false)
  const eventSourceRef = useRef<EventSource | null>(null)

  // Initialize notification permission
  useEffect(() => {
    setNotificationsEnabled(getNotificationsEnabled())
  }, [])

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
      'worktree_created', 'worktree_cleanup', 'session_status', 'done', 'aborted',
      // Planning phase events
      'plan', 'plan_message', 'plan_approved', 'plan_rejected'
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
            setCurrentPhase(data.phase as 'planning' | 'implement' | 'polish')
          }

          // Planning events
          if (type === 'plan') {
            if (data.plan) setCurrentPlan(data.plan as PlanStep[])
            if (data.summary) setPlanSummary(data.summary as string)
            if (data.risks) setPlanRisks(data.risks as string[])
          }

          if (type === 'plan_approved') {
            if (data.plan) setCurrentPlan(data.plan as PlanStep[])
          }

          // Send browser notification for important events
          if (notificationsEnabled) {
            handleEventNotification(session.id, type, data)
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
  }, [session.id, notificationsEnabled])

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
            {session.status === 'planning' && (
              <span className="text-orange-400 text-sm animate-pulse">● PLANNING</span>
            )}
            {session.status === 'awaiting_approval' && (
              <span className="text-yellow-400 text-sm">⏸ AWAITING APPROVAL</span>
            )}
            {['running', 'planning', 'awaiting_approval'].includes(session.status) && onAbortSession && (
              <button
                onClick={() => {
                  if (window.confirm('Are you sure you want to abort this session?')) {
                    onAbortSession(session.id)
                  }
                }}
                className="px-4 py-2 text-sm text-red-400 border border-red-800 rounded hover:bg-red-900/30 transition-colors"
              >
                ✕ ABORT
              </button>
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

        {/* Phase Indicator (when running or planning) */}
        {['running', 'planning', 'awaiting_approval'].includes(session.status) && (
          <div className="mb-6 flex gap-4">
            {session.enablePlanning && (
              <PhaseIndicator
                label="Phase 0: Planning"
                active={currentPhase === 'planning'}
                complete={currentPhase === 'implement' || currentPhase === 'polish'}
                code="0x00"
              />
            )}
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

        {/* Planning Panel (when awaiting approval) */}
        {session.status === 'awaiting_approval' && currentPlan && onApprovePlan && onRejectPlan && (
          <div className="mb-6 p-5 bg-black rounded border border-orange-500/30 relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-orange-400 to-transparent" />
            <div className="text-orange-400 text-xs mb-4 uppercase tracking-widest flex items-center gap-2">
              <span>◆</span> Implementation Plan - Awaiting Approval
            </div>

            {planSummary && (
              <p className="text-gray-300 text-sm mb-4">{planSummary}</p>
            )}

            <div className="space-y-3 mb-4">
              {currentPlan.map((step, idx) => (
                <div key={step.id} className="p-3 bg-gray-900/50 rounded border border-gray-800">
                  <div className="flex items-start gap-3">
                    <span className="text-orange-500 font-mono text-xs">{idx + 1}.</span>
                    <div>
                      <h4 className="text-gray-200 font-medium text-sm">{step.title}</h4>
                      <p className="text-gray-500 text-xs mt-1">{step.description}</p>
                      {step.files.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {step.files.map((file, i) => (
                            <span key={i} className="text-[10px] px-2 py-0.5 bg-gray-800 rounded text-gray-400 font-mono">
                              {file}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {planRisks.length > 0 && (
              <div className="mb-4 p-3 bg-red-900/20 rounded border border-red-800/30">
                <div className="text-red-400 text-xs mb-2 uppercase tracking-widest">Risks</div>
                <ul className="space-y-1">
                  {planRisks.map((risk, i) => (
                    <li key={i} className="text-red-300 text-xs flex items-start gap-2">
                      <span>⚠</span> {risk}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => onApprovePlan(session.id, currentPlan)}
                className="flex-1 px-4 py-2 text-sm text-green-400 border border-green-800 rounded hover:bg-green-900/30 transition-colors"
              >
                ✓ APPROVE & START
              </button>
              <button
                onClick={() => {
                  const reason = window.prompt('Why are you rejecting this plan? (Leave empty to cancel session)')
                  if (reason !== null) {
                    onRejectPlan(session.id, reason || undefined)
                  }
                }}
                className="flex-1 px-4 py-2 text-sm text-red-400 border border-red-800 rounded hover:bg-red-900/30 transition-colors"
              >
                ✗ REJECT
              </button>
            </div>
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

        {/* File Changes */}
        {session.branchName && (
          <div className="mb-6 p-5 bg-black rounded border border-purple-500/30 relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-purple-400 to-transparent" />
            <FileChangesSection sessionId={session.id} branchName={session.branchName} />
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
