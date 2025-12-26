'use client'

import { useState, useEffect, useCallback } from 'react'
import { SessionCard } from './SessionCard'
import type { Session } from '@/lib/session-store'

interface SessionListProps {
  sessions: Session[]
  selectedSessionId: string | null
  onSelectSession: (id: string) => void
  onCancelSession: (id: string) => void
  onDeleteSession: (id: string) => void
  onCreatePR: (session: Session) => void
  onRefresh: () => void
}

type FilterStatus = 'all' | 'running' | 'completed' | 'failed'
type SortBy = 'newest' | 'oldest' | 'score' | 'commits'

export function SessionList({
  sessions,
  selectedSessionId,
  onSelectSession,
  onCancelSession,
  onDeleteSession,
  onCreatePR,
  onRefresh
}: SessionListProps) {
  const [filter, setFilter] = useState<FilterStatus>('all')
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState<SortBy>('newest')

  // Active session statuses
  const isActiveStatus = (status: string) =>
    ['running', 'pending', 'planning', 'awaiting_approval'].includes(status)

  // Auto-refresh when active sessions exist
  useEffect(() => {
    if (!autoRefresh) return

    const hasActive = sessions.some(s => isActiveStatus(s.status))
    if (!hasActive) return

    const interval = setInterval(onRefresh, 2000)
    return () => clearInterval(interval)
  }, [sessions, autoRefresh, onRefresh])

  const filteredSessions = sessions
    .filter(s => {
      if (filter === 'all') return true
      if (filter === 'running') return isActiveStatus(s.status)
      if (filter === 'completed') return s.status === 'completed'
      if (filter === 'failed') return s.status === 'failed' || s.status === 'cancelled'
      return true
    })
    .filter(s => {
      if (!searchQuery) return true
      const query = searchQuery.toLowerCase()
      return (
        s.mission?.toLowerCase().includes(query) ||
        s.id.toLowerCase().includes(query) ||
        s.branchName?.toLowerCase().includes(query)
      )
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'newest':
          return new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
        case 'oldest':
          return new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime()
        case 'score':
          const scoreA = a.finalScore ?? a.initialScore ?? 0
          const scoreB = b.finalScore ?? b.initialScore ?? 0
          return scoreB - scoreA
        case 'commits':
          return b.commits - a.commits
        default:
          return 0
      }
    })

  const counts = {
    all: sessions.length,
    running: sessions.filter(s => isActiveStatus(s.status)).length,
    completed: sessions.filter(s => s.status === 'completed').length,
    failed: sessions.filter(s => s.status === 'failed' || s.status === 'cancelled').length
  }

  return (
    <div className="space-y-4">
      {/* Search Bar */}
      <div className="relative">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder=">> Search sessions (mission, ID, branch)..."
          className="
            w-full bg-black/50 border border-green-800/50 rounded px-4 py-2.5
            text-sm text-green-300 placeholder-green-900
            focus:outline-none focus:border-green-400 focus:box-glow
            font-mono pl-10
          "
        />
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-green-700">🔍</span>
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-600 hover:text-green-400 transition-colors"
          >
            ✕
          </button>
        )}
      </div>

      {/* Filters & Sort */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <FilterButton
            label="ALL"
            count={counts.all}
            active={filter === 'all'}
            onClick={() => setFilter('all')}
            color="gray"
          />
          <FilterButton
            label="RUNNING"
            count={counts.running}
            active={filter === 'running'}
            onClick={() => setFilter('running')}
            color="green"
          />
          <FilterButton
            label="COMPLETED"
            count={counts.completed}
            active={filter === 'completed'}
            onClick={() => setFilter('completed')}
            color="cyan"
          />
          <FilterButton
            label="FAILED"
            count={counts.failed}
            active={filter === 'failed'}
            onClick={() => setFilter('failed')}
            color="red"
          />
        </div>

        <div className="flex items-center gap-3">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortBy)}
            className="text-[10px] tracking-widest px-2 py-1 rounded border bg-black text-gray-400 border-gray-800 hover:border-green-800 transition-colors cursor-pointer"
          >
            <option value="newest">NEWEST FIRST</option>
            <option value="oldest">OLDEST FIRST</option>
            <option value="score">HIGHEST SCORE</option>
            <option value="commits">MOST COMMITS</option>
          </select>
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`text-[10px] tracking-widest px-2 py-1 rounded border transition-colors ${
              autoRefresh
                ? 'text-green-400 border-green-800 bg-green-900/20'
                : 'text-gray-600 border-gray-800'
            }`}
          >
            {autoRefresh ? '● AUTO' : '○ MANUAL'}
          </button>
          <button
            onClick={onRefresh}
            className="text-[10px] tracking-widest text-gray-500 hover:text-green-400 px-2 py-1 border border-gray-800 rounded hover:border-green-800 transition-colors"
          >
            ↻ REFRESH
          </button>
        </div>
      </div>

      {/* Sessions Grid */}
      {filteredSessions.length === 0 ? (
        <div className="text-center py-12 border border-gray-800 rounded bg-black/30">
          <div className="text-gray-700 text-4xl mb-2">◇</div>
          <div className="text-gray-600 text-xs tracking-widest">
            {filter === 'all' ? 'NO SESSIONS' : `NO ${filter.toUpperCase()} SESSIONS`}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredSessions.map(session => (
            <SessionCard
              key={session.id}
              session={session}
              isSelected={selectedSessionId === session.id}
              onSelect={() => onSelectSession(session.id)}
              onCancel={() => onCancelSession(session.id)}
              onDelete={() => onDeleteSession(session.id)}
              onCreatePR={() => onCreatePR(session)}
            />
          ))}
        </div>
      )}

      {/* Session count footer */}
      <div className="flex items-center justify-between text-[10px] text-gray-700 tracking-widest pt-2 border-t border-gray-900">
        <span>SHOWING {filteredSessions.length} OF {sessions.length} SESSIONS</span>
        <span>DB: .polish/sessions.db</span>
      </div>
    </div>
  )
}

function FilterButton({
  label,
  count,
  active,
  onClick,
  color
}: {
  label: string
  count: number
  active: boolean
  onClick: () => void
  color: 'gray' | 'green' | 'cyan' | 'red'
}) {
  const colors = {
    gray: {
      active: 'text-white border-gray-500 bg-gray-800/50',
      inactive: 'text-gray-600 border-gray-800 hover:text-gray-400'
    },
    green: {
      active: 'text-green-400 border-green-500 bg-green-900/30',
      inactive: 'text-gray-600 border-gray-800 hover:text-green-400'
    },
    cyan: {
      active: 'text-cyan-400 border-cyan-500 bg-cyan-900/30',
      inactive: 'text-gray-600 border-gray-800 hover:text-cyan-400'
    },
    red: {
      active: 'text-red-400 border-red-500 bg-red-900/30',
      inactive: 'text-gray-600 border-gray-800 hover:text-red-400'
    }
  }

  return (
    <button
      onClick={onClick}
      className={`
        text-[10px] tracking-widest px-3 py-1.5 rounded border transition-colors
        ${active ? colors[color].active : colors[color].inactive}
      `}
    >
      {label}
      {count > 0 && (
        <span className="ml-1 opacity-60">[{count}]</span>
      )}
    </button>
  )
}

export default SessionList
