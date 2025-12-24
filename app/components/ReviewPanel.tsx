'use client'

import { useState } from 'react'

export type ReviewVerdict = 'approved' | 'needs_changes' | 'rejected'

interface ReviewResult {
  verdict: ReviewVerdict
  feedback: string
  concerns: string[]
  score?: number
}

interface ReviewPanelProps {
  iteration: number
  maxIterations: number
  review?: ReviewResult
  isLoading?: boolean
  redirectTo?: 'implement' | 'testing'
  isComplete?: boolean
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
    bgColor: 'bg-green-900/20',
    borderColor: 'border-green-500/50'
  },
  needs_changes: {
    label: 'NEEDS CHANGES',
    icon: '⚠',
    color: 'text-orange-400',
    bgColor: 'bg-orange-900/20',
    borderColor: 'border-orange-500/50'
  },
  rejected: {
    label: 'REJECTED',
    icon: '✗',
    color: 'text-red-400',
    bgColor: 'bg-red-900/20',
    borderColor: 'border-red-500/50'
  }
}

export function ReviewPanel({
  iteration,
  maxIterations,
  review,
  isLoading = false,
  redirectTo,
  isComplete = false
}: ReviewPanelProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const verdictConfig = review ? VERDICT_CONFIG[review.verdict] : null

  return (
    <div className="p-5 bg-black rounded border border-fuchsia-500/30 relative overflow-hidden">
      {/* Top gradient line */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-fuchsia-400 to-transparent" />

      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <span className="text-fuchsia-400 text-xl">◆</span>
          <div>
            <div className="text-fuchsia-400 text-xs uppercase tracking-widest font-bold">
              Code Review
            </div>
            <div className="text-[10px] text-gray-600 tracking-widest">
              Phase 3 - Quality Check
            </div>
          </div>
        </div>

        {/* Iteration Counter */}
        <div className="flex items-center gap-3">
          <div className="text-[10px] text-gray-500 tracking-widest">
            ITERATION
          </div>
          <div className="flex items-center gap-1">
            {Array.from({ length: maxIterations }).map((_, i) => (
              <div
                key={i}
                className={`w-3 h-3 rounded-full border transition-all ${
                  i < iteration
                    ? 'bg-fuchsia-500 border-fuchsia-400'
                    : i === iteration - 1
                      ? 'bg-fuchsia-500 border-fuchsia-400 animate-pulse'
                      : 'bg-gray-900 border-gray-700'
                }`}
              />
            ))}
          </div>
          <span className="text-fuchsia-400 font-mono text-sm">
            {iteration}/{maxIterations}
          </span>
        </div>
      </div>

      {/* Loading State */}
      {isLoading && !review && (
        <div className="p-6 rounded border border-fuchsia-800/50 bg-fuchsia-900/10 animate-pulse">
          <div className="flex items-center gap-3 text-fuchsia-400">
            <span className="animate-spin text-xl">⟳</span>
            <span className="text-sm tracking-widest">Reviewing code...</span>
          </div>
        </div>
      )}

      {/* Review Result */}
      {review && verdictConfig && (
        <div className={`p-4 rounded border ${verdictConfig.borderColor} ${verdictConfig.bgColor}`}>
          {/* Verdict Badge */}
          <div className="flex items-center justify-between mb-4">
            <div className={`
              px-4 py-2 rounded border text-sm font-bold tracking-widest
              ${verdictConfig.bgColor} ${verdictConfig.borderColor} ${verdictConfig.color}
            `}>
              <span className="mr-2">{verdictConfig.icon}</span>
              {verdictConfig.label}
            </div>

            {/* Score */}
            {review.score !== undefined && (
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-gray-500 uppercase tracking-widest">Score</span>
                <span className={`font-mono text-lg ${
                  review.score >= 80 ? 'text-green-400' :
                  review.score >= 60 ? 'text-yellow-400' :
                  review.score >= 40 ? 'text-orange-400' : 'text-red-400'
                }`}>
                  {review.score}
                </span>
              </div>
            )}
          </div>

          {/* Score Bar */}
          {review.score !== undefined && (
            <div className="mb-4">
              <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    review.score >= 80 ? 'bg-green-500' :
                    review.score >= 60 ? 'bg-yellow-500' :
                    review.score >= 40 ? 'bg-orange-500' : 'bg-red-500'
                  }`}
                  style={{ width: `${review.score}%` }}
                />
              </div>
            </div>
          )}

          {/* Concerns */}
          {review.concerns.length > 0 && (
            <div className="mb-4">
              <div className="text-[10px] text-gray-500 uppercase tracking-widest mb-2">
                Issues Found ({review.concerns.length})
              </div>
              <ul className="space-y-1">
                {review.concerns.slice(0, isExpanded ? review.concerns.length : 5).map((concern, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-gray-400">
                    <span className="text-orange-500">•</span>
                    <span className="font-mono">{concern}</span>
                  </li>
                ))}
                {!isExpanded && review.concerns.length > 5 && (
                  <li
                    className="text-xs text-fuchsia-400 cursor-pointer hover:text-fuchsia-300"
                    onClick={() => setIsExpanded(true)}
                  >
                    +{review.concerns.length - 5} more issues...
                  </li>
                )}
              </ul>
            </div>
          )}

          {/* Feedback */}
          {review.feedback && (
            <div
              className="text-sm text-gray-300 cursor-pointer"
              onClick={() => setIsExpanded(!isExpanded)}
            >
              <div className="text-[10px] text-gray-500 uppercase tracking-widest mb-2 flex items-center gap-1">
                <span>Feedback</span>
                <span className="text-gray-700">{isExpanded ? '▼' : '▶'}</span>
              </div>
              <p className={`whitespace-pre-wrap leading-relaxed ${isExpanded ? '' : 'line-clamp-3'}`}>
                {review.feedback}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Redirect Info */}
      {review && review.verdict !== 'approved' && redirectTo && (
        <div className="mt-4 p-3 bg-gray-900/50 rounded border border-gray-800">
          <div className="flex items-center gap-2 text-xs">
            <span className="text-orange-400">↩</span>
            <span className="text-gray-400">Redirecting to</span>
            <span className={`font-bold ${
              redirectTo === 'implement' ? 'text-cyan-400' : 'text-green-400'
            }`}>
              {redirectTo === 'implement' ? 'Phase 1: Implement' : 'Phase 2: Testing'}
            </span>
          </div>
        </div>
      )}

      {/* Success Banner */}
      {isComplete && review?.verdict === 'approved' && (
        <div className="mt-4 p-3 rounded border bg-green-900/20 border-green-500/50 text-center">
          <span className="text-green-400 text-xl mr-2">✓</span>
          <span className="text-green-400 font-bold tracking-widest text-sm">
            READY FOR PRODUCTION
          </span>
        </div>
      )}
    </div>
  )
}

export default ReviewPanel
