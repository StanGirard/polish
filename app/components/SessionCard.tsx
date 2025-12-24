'use client'

import { useState } from 'react'
import type { Session } from '@/lib/session-store'

interface SessionCardProps {
  session: Session
  isSelected: boolean
  onSelect: () => void
  onCancel: () => void
  onCreatePR: () => void
  onDelete: () => void
}

export function SessionCard({
  session,
  isSelected,
  onSelect,
  onCancel,
  onCreatePR,
  onDelete
}: SessionCardProps) {
  const [showConfirmDelete, setShowConfirmDelete] = useState(false)

  const statusConfig = {
    pending: {
      color: 'text-gray-400',
      border: 'border-gray-600',
      bg: 'bg-gray-900/30',
      glow: '',
      icon: '◌',
      label: 'PENDING'
    },
    running: {
      color: 'text-green-400',
      border: 'border-green-500/50',
      bg: 'bg-green-900/20',
      glow: 'box-glow',
      icon: '▶',
      label: 'RUNNING'
    },
    completed: {
      color: 'text-cyan-400',
      border: 'border-cyan-500/50',
      bg: 'bg-cyan-900/20',
      glow: 'box-glow-cyan',
      icon: '✓',
      label: 'COMPLETE'
    },
    failed: {
      color: 'text-red-400',
      border: 'border-red-500/50',
      bg: 'bg-red-900/20',
      glow: '',
      icon: '✗',
      label: 'FAILED'
    },
    cancelled: {
      color: 'text-yellow-400',
      border: 'border-yellow-500/50',
      bg: 'bg-yellow-900/20',
      glow: '',
      icon: '■',
      label: 'CANCELLED'
    }
  }

  const config = statusConfig[session.status]
  const shortId = session.id.slice(-6)
  const elapsed = session.duration
    ? `${(session.duration / 1000).toFixed(1)}s`
    : session.status === 'running'
      ? `${((Date.now() - new Date(session.startedAt).getTime()) / 1000).toFixed(0)}s`
      : '-'

  const delta = session.finalScore !== undefined && session.initialScore !== undefined
    ? session.finalScore - session.initialScore
    : null

  return (
    <div
      className={`
        relative p-4 rounded border cursor-pointer transition-all
        ${config.border} ${config.bg} ${config.glow}
        ${isSelected ? 'ring-2 ring-green-400/50' : ''}
        hover:border-green-400/50 hover:bg-black/50
        data-stream
      `}
      onClick={onSelect}
    >
      {/* Top gradient line */}
      <div className={`absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent ${config.color.replace('text-', 'via-')} to-transparent`} />

      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className={`${config.color} ${session.status === 'running' ? 'blink' : ''}`}>
            {config.icon}
          </span>
          <span className="text-gray-300 font-mono text-sm">
            SESSION
          </span>
          <span className={`${config.color} font-bold`}>
            #{shortId}
          </span>
        </div>
        <span className={`text-[10px] ${config.color} tracking-widest px-2 py-0.5 border ${config.border} rounded`}>
          {config.label}
        </span>
      </div>

      {/* Mission */}
      {session.mission && (
        <div className="mb-3 text-xs text-gray-400">
          <span className="text-gray-600 uppercase tracking-widest mr-2">MISSION:</span>
          <span className="text-gray-300">{session.mission.slice(0, 50)}{session.mission.length > 50 ? '...' : ''}</span>
        </div>
      )}

      {/* Branch */}
      {session.branchName && (
        <div className="mb-3 text-xs font-mono">
          <span className="text-gray-600 uppercase tracking-widest mr-2">BRANCH:</span>
          <span className="text-magenta-400 text-[11px]">{session.branchName.slice(-30)}</span>
        </div>
      )}

      {/* Score */}
      {session.initialScore != null && (
        <div className="mb-3 flex items-center gap-3 text-sm font-mono">
          <span className="text-gray-600 uppercase tracking-widest text-xs">SCORE:</span>
          <span className="text-gray-400">{session.initialScore.toFixed(0)}</span>
          {session.finalScore != null && (
            <>
              <span className="text-gray-700">→</span>
              <span className={session.finalScore > session.initialScore ? 'text-green-400' : 'text-gray-400'}>
                {session.finalScore.toFixed(0)}
              </span>
              {delta !== null && delta !== 0 && (
                <span className={`text-xs ${delta > 0 ? 'text-green-400' : 'text-red-400'}`}>
                  ({delta > 0 ? '+' : ''}{delta.toFixed(1)})
                </span>
              )}
            </>
          )}
        </div>
      )}

      {/* Stats */}
      <div className="flex items-center gap-4 text-[10px] text-gray-600 tracking-widest">
        <span>⏱ {elapsed}</span>
        <span>|</span>
        <span>📦 {session.commits} COMMITS</span>
      </div>

      {/* Actions */}
      <div
        className="mt-3 pt-3 border-t border-gray-800 flex items-center gap-2"
        onClick={(e) => e.stopPropagation()}
      >
        {session.status === 'running' && (
          <button
            onClick={(e) => { e.stopPropagation(); e.preventDefault(); onCancel() }}
            className="px-3 py-1 text-xs text-red-400 border border-red-800 rounded hover:bg-red-900/30 transition-colors"
          >
            ■ ABORT
          </button>
        )}

        {session.status === 'completed' && session.branchName && (
          <button
            onClick={(e) => { e.stopPropagation(); e.preventDefault(); onCreatePR() }}
            className="px-3 py-1 text-xs text-purple-400 border border-purple-800 rounded hover:bg-purple-900/30 transition-colors"
          >
            ⬆ CREATE PR
          </button>
        )}

        {(session.status === 'completed' || session.status === 'failed' || session.status === 'cancelled') && (
          <>
            {showConfirmDelete ? (
              <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                <button
                  onClick={(e) => { e.stopPropagation(); e.preventDefault(); onDelete(); setShowConfirmDelete(false) }}
                  className="px-3 py-1 text-xs text-red-400 border border-red-800 rounded hover:bg-red-900/50 transition-colors"
                >
                  CONFIRM
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); e.preventDefault(); setShowConfirmDelete(false) }}
                  className="px-3 py-1 text-xs text-gray-500 border border-gray-800 rounded hover:bg-gray-900/50 transition-colors"
                >
                  CANCEL
                </button>
              </div>
            ) : (
              <button
                onClick={(e) => { e.stopPropagation(); e.preventDefault(); setShowConfirmDelete(true) }}
                className="px-3 py-1 text-xs text-gray-500 border border-gray-800 rounded hover:bg-gray-900/50 hover:text-red-400 transition-colors"
              >
                ✗ DELETE
              </button>
            )}
          </>
        )}
      </div>
    </div>
  )
}

export default SessionCard
