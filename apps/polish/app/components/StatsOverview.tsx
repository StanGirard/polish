'use client'

import type { Session } from '@/lib/session-store'

interface StatsOverviewProps {
  sessions: Session[]
}

export function StatsOverview({ sessions }: StatsOverviewProps) {
  const totalSessions = sessions.length
  const completedSessions = sessions.filter(s => s.status === 'completed').length
  const failedSessions = sessions.filter(s => s.status === 'failed' || s.status === 'cancelled').length
  const totalCommits = sessions.reduce((acc, s) => acc + s.commits, 0)

  const avgScoreImprovement = sessions
    .filter(s => s.finalScore !== undefined && s.initialScore !== undefined)
    .reduce((acc, s) => acc + (s.finalScore! - s.initialScore!), 0) /
    (sessions.filter(s => s.finalScore !== undefined && s.initialScore !== undefined).length || 1)

  const successRate = totalSessions > 0
    ? (completedSessions / totalSessions * 100).toFixed(0)
    : 0

  const stats = [
    {
      label: 'Total Sessions',
      value: totalSessions,
      color: 'text-gray-400',
      bg: 'bg-gray-900/30',
      border: 'border-gray-700'
    },
    {
      label: 'Success Rate',
      value: `${successRate}%`,
      color: 'text-green-400',
      bg: 'bg-green-900/20',
      border: 'border-green-800'
    },
    {
      label: 'Total Commits',
      value: totalCommits,
      color: 'text-yellow-400',
      bg: 'bg-yellow-900/20',
      border: 'border-yellow-800'
    },
    {
      label: 'Avg Improvement',
      value: `+${avgScoreImprovement.toFixed(1)}`,
      color: 'text-cyan-400',
      bg: 'bg-cyan-900/20',
      border: 'border-cyan-800'
    },
    {
      label: 'Failed',
      value: failedSessions,
      color: 'text-red-400',
      bg: 'bg-red-900/20',
      border: 'border-red-800'
    }
  ]

  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
      {stats.map((stat, idx) => (
        <div
          key={idx}
          className={`
            ${stat.bg} ${stat.border} border rounded p-4
            hover:scale-105 transition-transform cursor-default
            relative overflow-hidden group
          `}
        >
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-current to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

          <div className={`text-2xl font-bold ${stat.color} mb-1 font-mono`}>
            {stat.value}
          </div>
          <div className="text-[10px] text-gray-600 uppercase tracking-widest">
            {stat.label}
          </div>
        </div>
      ))}
    </div>
  )
}

export default StatsOverview
