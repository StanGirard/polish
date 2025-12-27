'use client'

import { useState, useEffect, useCallback } from 'react'
import { SessionList } from './components/SessionList'
import { SessionDetail } from './components/SessionDetail'
import { NewSessionForm } from './components/NewSessionForm'
import { BackendSettings, BackendIndicator } from './components/BackendSettings'
import { ProviderManager, ProviderIndicator } from './components/ProviderManager'
import { apiFetch } from '@/app/lib/api-client'
import type { Session } from '@/lib/session-store'
import type { CapabilityOverride } from '@/lib/types'

export default function Home() {
  const [sessions, setSessions] = useState<Session[]>([])
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [showProviderManager, setShowProviderManager] = useState(false)
  const [prState, setPrState] = useState<{
    sessionId: string
    loading: boolean
    url?: string
    error?: string
  } | null>(null)

  // Load sessions
  const loadSessions = useCallback(async () => {
    try {
      const res = await apiFetch('/api/sessions')
      if (res.ok) {
        const data = await res.json()
        setSessions(data.sessions.map((s: Session) => ({
          ...s,
          startedAt: new Date(s.startedAt),
          completedAt: s.completedAt ? new Date(s.completedAt) : undefined
        })))
      }
    } catch (error) {
      console.error('Failed to load sessions:', error)
    }
  }, [])

  // Initial load
  useEffect(() => {
    loadSessions()
  }, [loadSessions])

  // Create new session
  const handleCreateSession = async (
    mission?: string,
    extendedThinking?: boolean,
    capabilityOverrides?: CapabilityOverride[],
    enablePlanning?: boolean,
    providerId?: string
  ) => {
    setIsCreating(true)
    try {
      const res = await apiFetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mission,
          maxThinkingTokens: extendedThinking ? 16000 : undefined,
          capabilityOverrides,
          enablePlanning,
          providerId
        })
      })

      const data = await res.json().catch(() => ({ error: 'Failed to create session' }))

      if (!res.ok) {
        throw new Error(data.error || 'Failed to create session')
      }

      // Add to list and select
      await loadSessions()
      setSelectedSessionId(data.sessionId)
    } catch (error) {
      console.error('Failed to create session:', error)
      throw error // Re-throw to let the form handle the error
    } finally {
      setIsCreating(false)
    }
  }

  // Cancel session
  const handleCancelSession = async (sessionId: string) => {
    try {
      await apiFetch(`/api/sessions/${sessionId}`, { method: 'DELETE' })
      await loadSessions()
    } catch (error) {
      console.error('Failed to cancel session:', error)
    }
  }

  // Delete session
  const handleDeleteSession = async (sessionId: string) => {
    try {
      await apiFetch(`/api/sessions/${sessionId}`, { method: 'DELETE' })
      if (selectedSessionId === sessionId) {
        setSelectedSessionId(null)
      }
      await loadSessions()
    } catch (error) {
      console.error('Failed to delete session:', error)
    }
  }

  // Create PR
  const handleCreatePR = async (session: Session) => {
    if (!session.branchName) return

    setPrState({ sessionId: session.id, loading: true })

    try {
      const res = await apiFetch('/api/create-pr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          branchName: session.branchName,
          title: `Polish: ${session.mission || 'Code quality improvements'}`,
          customDescription: session.mission ? `Mission: ${session.mission}` : undefined
        })
      })

      const data = await res.json()

      if (res.ok) {
        setPrState({ sessionId: session.id, loading: false, url: data.prUrl })
      } else {
        setPrState({ sessionId: session.id, loading: false, error: data.error })
      }
    } catch (error) {
      setPrState({
        sessionId: session.id,
        loading: false,
        error: error instanceof Error ? error.message : 'Failed to create PR'
      })
    }
  }

  // Retry session with feedback
  const handleRetrySession = async (sessionId: string, feedback: string) => {
    try {
      const res = await apiFetch(`/api/sessions/${sessionId}/retry`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ feedback })
      })

      if (res.ok) {
        await loadSessions()
        // La session est maintenant running, on reste dessus
      }
    } catch (error) {
      console.error('Failed to retry session:', error)
    }
  }

  // Submit feedback for session
  const handleFeedbackSubmit = async (
    sessionId: string,
    rating: 'satisfied' | 'unsatisfied',
    comment?: string
  ) => {
    try {
      const res = await apiFetch(`/api/sessions/${sessionId}/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rating, comment })
      })

      if (res.ok) {
        await loadSessions()
      }
    } catch (error) {
      console.error('Failed to submit feedback:', error)
    }
  }

  // Approve plan and start implementation
  const handleApprovePlan = async (sessionId: string, selectedApproachId: string) => {
    try {
      const res = await apiFetch(`/api/sessions/${sessionId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ selectedApproachId })
      })

      if (res.ok) {
        await loadSessions()
      }
    } catch (error) {
      console.error('Failed to approve plan:', error)
    }
  }

  // Reject plan (with or without reason)
  const handleRejectPlan = async (sessionId: string, reason?: string) => {
    try {
      const res = await apiFetch(`/api/sessions/${sessionId}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason })
      })

      if (res.ok) {
        await loadSessions()
      }
    } catch (error) {
      console.error('Failed to reject plan:', error)
    }
  }

  // Send message during planning phase
  const handleSendPlanMessage = async (sessionId: string, message: string) => {
    try {
      const res = await apiFetch(`/api/sessions/${sessionId}/plan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message })
      })

      if (res.ok) {
        await loadSessions()
      }
    } catch (error) {
      console.error('Failed to send plan message:', error)
    }
  }

  // Abort session (planning or running)
  const handleAbortSession = async (sessionId: string) => {
    try {
      const res = await apiFetch(`/api/sessions/${sessionId}/abort`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })

      if (res.ok) {
        await loadSessions()
      }
    } catch (error) {
      console.error('Failed to abort session:', error)
    }
  }

  const selectedSession = sessions.find(s => s.id === selectedSessionId)
  const activeSessions = sessions.filter(s =>
    ['running', 'pending', 'planning', 'awaiting_approval'].includes(s.status)
  )

  return (
    <main className="min-h-screen bg-black text-white p-8 font-mono relative">
      <div className="max-w-5xl mx-auto relative z-10">
        {/* Header */}
        <div className="mb-8 border border-green-900/30 rounded bg-black/50 p-5 box-glow relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-green-400 to-transparent" />
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-5xl font-bold glow-green tracking-wider mb-2">
                <span className="text-green-400">&gt;&gt;</span> POLISH.RUN
              </h1>
              <div className="flex items-center gap-4 text-[10px] text-green-700 uppercase tracking-widest">
                <span>[v0.2.0]</span>
                <span className="text-gray-800">|</span>
                <span>Multi-Session Code Quality Enhancement</span>
              </div>
              <div className="mt-2 text-[9px] text-gray-700 tracking-widest font-bold">
                █▓▒░ LLM-DRIVEN OPTIMIZATION ENGINE ░▒▓█
              </div>
            </div>
            <div className="text-right flex items-start gap-4">
              <ProviderIndicator onClick={() => setShowProviderManager(true)} />
              <BackendIndicator onClick={() => setShowSettings(true)} />
              {activeSessions.length > 0 ? (
                <div className="flex flex-col items-end gap-1">
                  <div className="flex items-center gap-2 px-3 py-1.5 border border-green-500/30 rounded bg-green-950/20">
                    <span className="text-green-400 blink">●</span>
                    <span className="text-green-400 text-sm font-bold">
                      {activeSessions.length} ACTIVE
                    </span>
                  </div>
                  <span className="text-[10px] text-green-700 tracking-widest">
                    SESSIONS RUNNING
                  </span>
                </div>
              ) : (
                <div className="text-[10px] text-gray-700 tracking-widest space-y-1">
                  <div>SYSTEM: <span className="text-gray-600">STANDBY</span></div>
                  <div>READY: <span className="text-green-700">TRUE</span></div>
                  <div>MODE: <span className="text-green-700">MULTI-SESSION</span></div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* New Session Form */}
        <div className="mb-6">
          <NewSessionForm
            onCreateSession={handleCreateSession}
            disabled={isCreating}
          />
        </div>

        {/* Sessions List */}
        <div className="mb-8 p-5 bg-black rounded border border-green-500/30 box-glow relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-green-400 to-transparent" />
          <div className="text-green-400 text-xs mb-4 uppercase tracking-widest flex items-center gap-2">
            <span>◆</span> Sessions
            <span className="text-gray-800">|</span>
            <span className="text-gray-700 text-[9px]">SQLITE BACKED</span>
          </div>

          <SessionList
            sessions={sessions}
            selectedSessionId={selectedSessionId}
            onSelectSession={setSelectedSessionId}
            onCancelSession={handleCancelSession}
            onDeleteSession={handleDeleteSession}
            onCreatePR={handleCreatePR}
            onRefresh={loadSessions}
          />
        </div>

        {/* PR Creation Status (if any) */}
        {prState && (
          <div className={`mb-6 p-4 rounded border ${
            prState.loading
              ? 'border-purple-500/30 bg-purple-900/20'
              : prState.error
                ? 'border-red-500/30 bg-red-900/20'
                : 'border-green-500/30 bg-green-900/20'
          }`}>
            {prState.loading ? (
              <div className="flex items-center gap-3">
                <span className="text-purple-400 animate-spin">◌</span>
                <span className="text-purple-400 text-sm">Creating Pull Request...</span>
              </div>
            ) : prState.error ? (
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-red-400 text-xs uppercase tracking-widest mb-1">
                    ✗ PR Creation Failed
                  </div>
                  <div className="text-red-300 text-sm">{prState.error}</div>
                </div>
                <button
                  onClick={() => setPrState(null)}
                  className="text-gray-500 hover:text-gray-300"
                >
                  ✕
                </button>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-green-400 text-xs uppercase tracking-widest mb-1 flex items-center gap-2">
                    <span>✓</span> Pull Request Created
                  </div>
                  <a
                    href={prState.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-green-300 hover:text-green-200 text-sm underline"
                  >
                    {prState.url}
                  </a>
                </div>
                <a
                  href={prState.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2 bg-green-600/30 hover:bg-green-600/50 border border-green-400 text-green-300 rounded text-sm"
                >
                  ↗ View PR
                </a>
              </div>
            )}
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
              <span>KERNEL: v0.2.0</span>
              <span className="text-gray-800">|</span>
              <span>STORAGE: SQLITE</span>
            </div>
          </div>
          <div className="mt-2 text-center text-[8px] text-gray-800 tracking-widest">
            █▓▒░ MULTI-SESSION CODE QUALITY ENHANCEMENT PROTOCOL ░▒▓█
          </div>
        </div>
      </div>

      {/* Session Detail Modal */}
      {selectedSession && (
        <SessionDetail
          session={selectedSession}
          onClose={() => setSelectedSessionId(null)}
          onCreatePR={() => handleCreatePR(selectedSession)}
          onRetry={handleRetrySession}
          onFeedbackSubmit={handleFeedbackSubmit}
          onApprovePlan={handleApprovePlan}
          onRejectPlan={handleRejectPlan}
          onSendPlanMessage={handleSendPlanMessage}
          onAbortSession={handleAbortSession}
        />
      )}

      {/* Backend Settings Modal */}
      <BackendSettings
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
      />

      {/* Provider Manager Modal */}
      <ProviderManager
        isOpen={showProviderManager}
        onClose={() => setShowProviderManager(false)}
      />
    </main>
  )
}
