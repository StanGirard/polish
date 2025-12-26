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
import { createApiEventSource } from '@/app/lib/api-client'
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
    // Streaming fields
    chunk?: string
    isThinking?: boolean
    subAgentType?: string
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
  interface Risk {
    description: string
    severity: 'low' | 'medium' | 'high'
    mitigation: string
  }

  const [planRisks, setPlanRisks] = useState<Risk[]>([])
  const [notificationsEnabled, setNotificationsEnabled] = useState(false)
  const eventSourceRef = useRef<EventSource | null>(null)

  // Streaming states for real-time planning display
  const [streamingText, setStreamingText] = useState('')
  const [thinkingBlocks, setThinkingBlocks] = useState<Array<{ id: string; text: string; timestamp: Date }>>([])
  const [expandedThinkingBlocks, setExpandedThinkingBlocks] = useState<Set<string>>(new Set())
  const [isStreaming, setIsStreaming] = useState(false)

  // Connection status for SSE
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'error'>('connecting')
  const reconnectAttemptsRef = useRef(0)
  const maxReconnectAttempts = 5

  // Maximum streaming text size (1MB) to prevent memory issues
  const MAX_STREAMING_TEXT_SIZE = 1024 * 1024

  // Track the current thinking block being streamed
  const currentThinkingBlockRef = useRef<{ id: string; startedAt: Date } | null>(null)

  // Initialize notification permission
  useEffect(() => {
    setNotificationsEnabled(getNotificationsEnabled())
  }, [])

  // Use ref to access notificationsEnabled in event handlers without causing reconnects
  const notificationsEnabledRef = useRef(notificationsEnabled)
  useEffect(() => {
    notificationsEnabledRef.current = notificationsEnabled
  }, [notificationsEnabled])

  // Subscribe to SSE stream with reconnection logic
  useEffect(() => {
    let isMounted = true
    let reconnectTimeoutId: NodeJS.Timeout | null = null

    const createEventSource = () => {
      if (!isMounted) return

      // Close existing connection if any
      if (eventSourceRef.current) {
        eventSourceRef.current.close()
      }

      setConnectionStatus('connecting')
      const eventSource = createApiEventSource(`/api/sessions/${session.id}/stream`)
      eventSourceRef.current = eventSource

      eventSource.onopen = () => {
        if (!isMounted) return
        setConnectionStatus('connected')
        reconnectAttemptsRef.current = 0 // Reset attempts on successful connection
      }

      // Handle specific event types
      const eventTypes = [
        'init', 'phase', 'implement_done', 'score', 'strategy',
        'agent', 'commit', 'rollback', 'result', 'error', 'status',
        'worktree_created', 'worktree_cleanup', 'session_status', 'done', 'aborted',
        // Planning phase events
        'plan', 'plan_message', 'plan_approved', 'plan_rejected',
        // Planning streaming events
        'plan_stream', 'plan_thinking'
      ]

      for (const type of eventTypes) {
        eventSource.addEventListener(type, (e) => {
          if (!isMounted) return

          try {
            const rawData = JSON.parse((e as MessageEvent).data)
            // Extract server timestamp from payload
            const { _timestamp, ...data } = rawData
            const polishEvent: PolishEvent = {
              type,
              data,
              timestamp: _timestamp ? new Date(_timestamp) : new Date()
            }

            if (type === 'session_status') {
              // Initial status update
              if (data.initialScore) setInitialScore(data.initialScore)
              if (data.finalScore) setScore(data.finalScore)
              return
            }

            if (type === 'done') {
              setConnectionStatus('disconnected')
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
              if (data.risks) setPlanRisks(data.risks as Risk[])
            }

            if (type === 'plan_approved') {
              if (data.plan) setCurrentPlan(data.plan as PlanStep[])
              // Reset streaming states when plan is approved
              setStreamingText('')
              setThinkingBlocks([])
              setIsStreaming(false)
              currentThinkingBlockRef.current = null
            }

            // Planning streaming events with size limit
            if (type === 'plan_stream') {
              setIsStreaming(true)
              setStreamingText(prev => {
                const newText = prev + (data.chunk || '')
                // Truncate if too large to prevent memory issues
                if (newText.length > MAX_STREAMING_TEXT_SIZE) {
                  console.warn('[SSE] Streaming text truncated due to size limit')
                  return newText.slice(-MAX_STREAMING_TEXT_SIZE)
                }
                return newText
              })
            }

            if (type === 'plan_thinking') {
              setIsStreaming(true)
              const chunk = data.chunk || ''
              const now = new Date()

              if (!chunk.trim()) return

              // Each substantial thinking event is typically a separate thinking session
              // We detect boundaries by looking for:
              // 1. First thinking chunk (no current block)
              // 2. Chunks that start with clear section markers or after a gap
              const lastBlock = currentThinkingBlockRef.current
              const timeSinceLastBlock = lastBlock ? now.getTime() - lastBlock.startedAt.getTime() : Infinity
              const looksLikeNewSection = chunk.match(/^(Let me|I need to|Now let me|First|To |Looking at|I'll |I will|Okay|Alright)/)

              // Start new block if: no current block, time gap > 2s, or clear section marker
              const startsNewBlock = !lastBlock || timeSinceLastBlock > 2000 || looksLikeNewSection

              if (startsNewBlock) {
                // Create a new thinking block
                const blockId = `thinking-${now.getTime()}-${Math.random()}`
                currentThinkingBlockRef.current = { id: blockId, startedAt: now }

                setThinkingBlocks(prev => [...prev, {
                  id: blockId,
                  text: chunk,
                  timestamp: now
                }])
              } else {
                // Append to the current thinking block
                setThinkingBlocks(prev => {
                  const blocks = [...prev]
                  if (blocks.length > 0) {
                    blocks[blocks.length - 1] = {
                      ...blocks[blocks.length - 1],
                      text: blocks[blocks.length - 1].text + chunk
                    }
                  }
                  return blocks
                })
                // Update timestamp to track continuity
                if (currentThinkingBlockRef.current) {
                  currentThinkingBlockRef.current.startedAt = now
                }
              }
            }

            // Reset streaming when plan is received (end of streaming)
            if (type === 'plan') {
              setIsStreaming(false)
              currentThinkingBlockRef.current = null
            }

            // Send browser notification for important events
            if (notificationsEnabledRef.current) {
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
              setConnectionStatus('disconnected')
              if (data.finalScore) setScore(data.finalScore)
            }
          } catch (err) {
            console.error('[SSE] Failed to parse event data:', err, 'Event type:', type)
          }
        })
      }

      eventSource.onerror = (err) => {
        if (!isMounted) return

        console.error('[SSE] Connection error:', err)
        setConnectionStatus('error')
        eventSource.close()

        // Attempt reconnection with exponential backoff
        if (reconnectAttemptsRef.current < maxReconnectAttempts) {
          const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 30000)
          console.log(`[SSE] Reconnecting in ${delay}ms (attempt ${reconnectAttemptsRef.current + 1}/${maxReconnectAttempts})`)
          reconnectAttemptsRef.current++

          reconnectTimeoutId = setTimeout(() => {
            if (isMounted) {
              createEventSource()
            }
          }, delay)
        } else {
          console.error('[SSE] Max reconnection attempts reached')
          setConnectionStatus('error')
        }
      }
    }

    createEventSource()

    return () => {
      isMounted = false
      if (reconnectTimeoutId) {
        clearTimeout(reconnectTimeoutId)
      }
      if (eventSourceRef.current) {
        eventSourceRef.current.close()
      }
    }
  }, [session.id, MAX_STREAMING_TEXT_SIZE])

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
            {/* Connection status indicator */}
            {['running', 'planning', 'awaiting_approval'].includes(session.status) && (
              <span className={`text-xs px-2 py-1 rounded ${
                connectionStatus === 'connected' ? 'text-green-400 bg-green-900/30' :
                connectionStatus === 'connecting' ? 'text-yellow-400 bg-yellow-900/30 animate-pulse' :
                connectionStatus === 'error' ? 'text-red-400 bg-red-900/30' :
                'text-gray-500 bg-gray-800/30'
              }`}>
                {connectionStatus === 'connected' ? '◉ LIVE' :
                 connectionStatus === 'connecting' ? '◎ CONNECTING' :
                 connectionStatus === 'error' ? '◌ RECONNECTING' :
                 '○ OFFLINE'}
              </span>
            )}
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

        {/* Planning Streaming Panel (when planning is in progress) */}
        {session.status === 'planning' && (streamingText || thinkingBlocks.length > 0 || isStreaming) && (
          <div className="mb-6 p-5 bg-black rounded border border-orange-500/30 relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-orange-400 to-transparent" />
            <div className="text-orange-400 text-xs mb-4 uppercase tracking-widest flex items-center gap-2">
              <span className={isStreaming ? 'animate-pulse' : ''}>◆</span>
              Planning in Progress
              {isStreaming && <span className="text-orange-300 animate-pulse">▋</span>}
            </div>

            {/* Extended Thinking Blocks */}
            {thinkingBlocks.length > 0 && (
              <div className="mb-4 space-y-2">
                <div className="text-purple-400 text-xs uppercase tracking-widest flex items-center gap-2">
                  <span>💭</span>
                  <span>Extended Thinking ({thinkingBlocks.length} {thinkingBlocks.length === 1 ? 'block' : 'blocks'})</span>
                </div>
                {thinkingBlocks.map((block, idx) => {
                  const isExpanded = expandedThinkingBlocks.has(block.id)
                  const isLastBlock = idx === thinkingBlocks.length - 1
                  const isStillStreaming = isLastBlock && isStreaming

                  return (
                    <div key={block.id} className="border border-purple-800/30 rounded overflow-hidden">
                      <button
                        onClick={() => {
                          setExpandedThinkingBlocks(prev => {
                            const next = new Set(prev)
                            if (next.has(block.id)) {
                              next.delete(block.id)
                            } else {
                              next.add(block.id)
                            }
                            return next
                          })
                        }}
                        className="w-full flex items-center gap-2 p-2 bg-purple-900/20 text-purple-400 text-xs hover:bg-purple-900/30 transition-colors"
                      >
                        <span>{isExpanded ? '▼' : '▶'}</span>
                        <span className="font-medium">Thinking Block #{idx + 1}</span>
                        <span className="text-purple-600 text-[10px]">
                          ({block.text.length.toLocaleString()} chars)
                        </span>
                        {isStillStreaming && (
                          <span className="ml-auto text-purple-300 animate-pulse">●</span>
                        )}
                        <span className="ml-auto text-purple-700 text-[10px]">
                          {block.timestamp.toLocaleTimeString()}
                        </span>
                      </button>
                      {isExpanded && (
                        <div className="p-3 bg-purple-900/10 border-t border-purple-800/30 max-h-64 overflow-y-auto">
                          <pre className="text-purple-300 text-xs whitespace-pre-wrap font-mono leading-relaxed">
                            {block.text}
                            {isStillStreaming && <span className="text-purple-400 animate-pulse">▋</span>}
                          </pre>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}

            {/* Streaming Text */}
            {streamingText && (
              <div className="p-3 bg-gray-900/50 rounded border border-gray-800 max-h-96 overflow-y-auto">
                <pre className="text-gray-300 text-sm whitespace-pre-wrap font-mono leading-relaxed">
                  {streamingText}
                  {isStreaming && <span className="text-orange-400 animate-pulse">▋</span>}
                </pre>
              </div>
            )}

            {/* Empty state while waiting for first chunk */}
            {!streamingText && thinkingBlocks.length === 0 && isStreaming && (
              <div className="flex items-center gap-3 text-gray-500 text-sm">
                <span className="animate-spin">⟳</span>
                <span>Analyzing codebase...</span>
              </div>
            )}
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
                      <span className={
                        risk.severity === 'high' ? 'text-red-500' :
                        risk.severity === 'medium' ? 'text-yellow-500' : 'text-green-500'
                      }>⚠</span>
                      <div>
                        <span>{risk.description}</span>
                        {risk.mitigation && (
                          <span className="text-zinc-500 ml-2">- {risk.mitigation}</span>
                        )}
                      </div>
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
