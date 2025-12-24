'use client'

import { VerdictCard, type ReviewAgentType, type ReviewVerdict } from './VerdictCard'

interface ReviewResult {
  agent: ReviewAgentType
  verdict: ReviewVerdict
  feedback: string
  concerns: string[]
  score?: number
}

interface ReviewPanelProps {
  iteration: number
  maxIterations: number
  reviews: ReviewResult[]
  pendingAgents?: ReviewAgentType[]
  redirectTo?: 'implement' | 'testing'
  combinedFeedback?: string
  isComplete?: boolean
  allApproved?: boolean
}

const AGENT_ORDER: ReviewAgentType[] = ['mission_reviewer', 'senior_engineer', 'code_reviewer']

export function ReviewPanel({
  iteration,
  maxIterations,
  reviews,
  pendingAgents = [],
  redirectTo,
  combinedFeedback,
  isComplete = false,
  allApproved = false
}: ReviewPanelProps) {
  // Create a map for quick lookup
  const reviewMap = new Map(reviews.map(r => [r.agent, r]))

  // Determine overall status
  const verdicts = reviews.map(r => r.verdict)
  const anyRejected = verdicts.includes('rejected')
  const allApprovedStatus = verdicts.length === 3 && verdicts.every(v => v === 'approved')

  return (
    <div className="p-5 bg-black rounded border border-magenta-500/30 relative overflow-hidden">
      {/* Top gradient line */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-fuchsia-400 to-transparent" />

      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <span className="text-fuchsia-400 text-xl">◆</span>
          <div>
            <div className="text-fuchsia-400 text-xs uppercase tracking-widest font-bold">
              Review Gate
            </div>
            <div className="text-[10px] text-gray-600 tracking-widest">
              Phase 3 - Quality Validation
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

      {/* Status Banner */}
      {isComplete && (
        <div className={`
          mb-4 p-3 rounded border text-center
          ${allApprovedStatus
            ? 'bg-green-900/20 border-green-500/50 text-green-400'
            : anyRejected
              ? 'bg-red-900/20 border-red-500/50 text-red-400'
              : 'bg-orange-900/20 border-orange-500/50 text-orange-400'
          }
        `}>
          <span className="text-xl mr-2">
            {allApprovedStatus ? '✓' : anyRejected ? '✗' : '⚠'}
          </span>
          <span className="font-bold tracking-widest text-sm">
            {allApprovedStatus
              ? 'ALL REVIEWERS APPROVED'
              : anyRejected
                ? 'REVIEW REJECTED'
                : 'CHANGES REQUESTED'
            }
          </span>
        </div>
      )}

      {/* Verdict Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        {AGENT_ORDER.map(agentType => {
          const review = reviewMap.get(agentType)
          const isPending = pendingAgents.includes(agentType)

          if (review) {
            return (
              <VerdictCard
                key={agentType}
                agent={agentType}
                verdict={review.verdict}
                feedback={review.feedback}
                concerns={review.concerns}
                score={review.score}
              />
            )
          }

          if (isPending) {
            return (
              <VerdictCard
                key={agentType}
                agent={agentType}
                verdict="needs_changes"
                feedback=""
                concerns={[]}
                isLoading={true}
              />
            )
          }

          return (
            <div
              key={agentType}
              className="p-4 rounded border border-gray-800 bg-gray-900/30 opacity-50"
            >
              <div className="text-gray-600 text-center text-xs tracking-widest">
                PENDING
              </div>
            </div>
          )
        })}
      </div>

      {/* Redirect Info */}
      {!allApprovedStatus && redirectTo && (
        <div className="p-3 bg-gray-900/50 rounded border border-gray-800">
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

      {/* Combined Feedback */}
      {combinedFeedback && (
        <div className="mt-4 p-3 bg-gray-900/30 rounded border border-gray-800 max-h-48 overflow-y-auto">
          <div className="text-[10px] text-gray-500 uppercase tracking-widest mb-2">
            Combined Feedback
          </div>
          <pre className="text-xs text-gray-400 whitespace-pre-wrap font-mono leading-relaxed">
            {combinedFeedback}
          </pre>
        </div>
      )}

      {/* Summary Stats */}
      {reviews.length > 0 && (
        <div className="mt-4 pt-3 border-t border-gray-800 flex items-center gap-6 text-[10px] text-gray-600 tracking-widest">
          <div className="flex items-center gap-2">
            <span className="text-green-400">✓</span>
            <span>{verdicts.filter(v => v === 'approved').length} Approved</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-orange-400">⚠</span>
            <span>{verdicts.filter(v => v === 'needs_changes').length} Changes</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-red-400">✗</span>
            <span>{verdicts.filter(v => v === 'rejected').length} Rejected</span>
          </div>
          {reviews.some(r => r.score !== undefined) && (
            <div className="flex items-center gap-2 ml-auto">
              <span>AVG:</span>
              <span className="text-fuchsia-400 font-mono">
                {Math.round(reviews.reduce((sum, r) => sum + (r.score || 0), 0) / reviews.filter(r => r.score !== undefined).length)}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default ReviewPanel
