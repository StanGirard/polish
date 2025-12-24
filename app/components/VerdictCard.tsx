'use client'

import { useState } from 'react'

export type ReviewAgentType = 'mission_reviewer' | 'senior_engineer' | 'code_reviewer'
export type ReviewVerdict = 'approved' | 'needs_changes' | 'rejected'

interface VerdictCardProps {
  agent: ReviewAgentType
  verdict: ReviewVerdict
  feedback: string
  concerns: string[]
  score?: number
  isLoading?: boolean
}

const AGENT_CONFIG: Record<ReviewAgentType, {
  icon: string
  name: string
  description: string
  color: string
  borderColor: string
  bgColor: string
}> = {
  mission_reviewer: {
    icon: '🎯',
    name: 'Mission Reviewer',
    description: 'Checks implementation matches original mission',
    color: 'text-cyan-400',
    borderColor: 'border-cyan-600/50',
    bgColor: 'bg-cyan-900/10'
  },
  senior_engineer: {
    icon: '🏗',
    name: 'Senior Engineer',
    description: 'Evaluates architecture and best practices',
    color: 'text-purple-400',
    borderColor: 'border-purple-600/50',
    bgColor: 'bg-purple-900/10'
  },
  code_reviewer: {
    icon: '🔍',
    name: 'Code Reviewer',
    description: 'Line-by-line code review',
    color: 'text-blue-400',
    borderColor: 'border-blue-600/50',
    bgColor: 'bg-blue-900/10'
  }
}

const VERDICT_CONFIG: Record<ReviewVerdict, {
  label: string
  icon: string
  color: string
  bgColor: string
  borderColor: string
}> = {
  approved: {
    label: 'APPROVED',
    icon: '✓',
    color: 'text-green-400',
    bgColor: 'bg-green-900/30',
    borderColor: 'border-green-500/50'
  },
  needs_changes: {
    label: 'NEEDS CHANGES',
    icon: '⚠',
    color: 'text-orange-400',
    bgColor: 'bg-orange-900/30',
    borderColor: 'border-orange-500/50'
  },
  rejected: {
    label: 'REJECTED',
    icon: '✗',
    color: 'text-red-400',
    bgColor: 'bg-red-900/30',
    borderColor: 'border-red-500/50'
  }
}

export function VerdictCard({
  agent,
  verdict,
  feedback,
  concerns,
  score,
  isLoading = false
}: VerdictCardProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const agentConfig = AGENT_CONFIG[agent]
  const verdictConfig = VERDICT_CONFIG[verdict]

  if (isLoading) {
    return (
      <div className={`
        p-4 rounded border ${agentConfig.borderColor} ${agentConfig.bgColor}
        relative overflow-hidden animate-pulse
      `}>
        <div className={`absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent ${agentConfig.color.replace('text-', 'via-')} to-transparent`} />

        <div className="flex items-center gap-3 mb-3">
          <span className="text-xl">{agentConfig.icon}</span>
          <div>
            <div className={`font-semibold text-sm ${agentConfig.color}`}>
              {agentConfig.name}
            </div>
            <div className="text-[10px] text-gray-600 tracking-widest">
              {agentConfig.description}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 text-gray-500 text-xs">
          <span className="animate-spin">⟳</span>
          <span>Reviewing...</span>
        </div>
      </div>
    )
  }

  return (
    <div className={`
      p-4 rounded border ${agentConfig.borderColor} ${agentConfig.bgColor}
      relative overflow-hidden transition-all
    `}>
      <div className={`absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent ${agentConfig.color.replace('text-', 'via-')} to-transparent`} />

      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <span className="text-xl">{agentConfig.icon}</span>
          <div>
            <div className={`font-semibold text-sm ${agentConfig.color}`}>
              {agentConfig.name}
            </div>
            <div className="text-[10px] text-gray-600 tracking-widest">
              {agentConfig.description}
            </div>
          </div>
        </div>

        {/* Verdict Badge */}
        <div className={`
          px-3 py-1 rounded border text-xs font-bold tracking-widest
          ${verdictConfig.bgColor} ${verdictConfig.borderColor} ${verdictConfig.color}
        `}>
          <span className="mr-1">{verdictConfig.icon}</span>
          {verdictConfig.label}
        </div>
      </div>

      {/* Score Bar */}
      {score !== undefined && (
        <div className="mb-3">
          <div className="flex items-center justify-between text-[10px] text-gray-500 mb-1">
            <span className="uppercase tracking-widest">Score</span>
            <span className={`font-mono ${
              score >= 80 ? 'text-green-400' :
              score >= 60 ? 'text-yellow-400' :
              score >= 40 ? 'text-orange-400' : 'text-red-400'
            }`}>
              {score}/100
            </span>
          </div>
          <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                score >= 80 ? 'bg-green-500' :
                score >= 60 ? 'bg-yellow-500' :
                score >= 40 ? 'bg-orange-500' : 'bg-red-500'
              }`}
              style={{ width: `${score}%` }}
            />
          </div>
        </div>
      )}

      {/* Concerns */}
      {concerns.length > 0 && (
        <div className="mb-3">
          <div className="text-[10px] text-gray-500 uppercase tracking-widest mb-2">
            Concerns ({concerns.length})
          </div>
          <ul className="space-y-1">
            {concerns.slice(0, isExpanded ? concerns.length : 3).map((concern, i) => (
              <li key={i} className="flex items-start gap-2 text-xs text-gray-400">
                <span className="text-orange-500">•</span>
                <span>{concern}</span>
              </li>
            ))}
            {!isExpanded && concerns.length > 3 && (
              <li className="text-xs text-gray-600">
                +{concerns.length - 3} more...
              </li>
            )}
          </ul>
        </div>
      )}

      {/* Feedback */}
      {feedback && (
        <div
          className={`
            text-xs text-gray-400 cursor-pointer
            ${isExpanded ? '' : 'line-clamp-3'}
          `}
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <div className="text-[10px] text-gray-500 uppercase tracking-widest mb-1 flex items-center gap-1">
            <span>Feedback</span>
            <span className="text-gray-700">{isExpanded ? '▼' : '▶'}</span>
          </div>
          <p className="whitespace-pre-wrap leading-relaxed">{feedback}</p>
        </div>
      )}
    </div>
  )
}

export default VerdictCard
