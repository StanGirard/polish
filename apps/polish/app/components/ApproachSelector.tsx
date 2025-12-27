'use client'

import { useState } from 'react'
import type { PlanningApproach, PlanStep } from '@/lib/types'

interface ApproachSelectorProps {
  approaches: PlanningApproach[]
  recommendedApproachId?: string
  onApprove: (approachId: string) => void
  onReject: (reason?: string) => void
}

export function ApproachSelector({
  approaches,
  recommendedApproachId,
  onApprove,
  onReject
}: ApproachSelectorProps) {
  const [selectedId, setSelectedId] = useState<string>(
    recommendedApproachId || approaches[0]?.id || ''
  )
  const [showRejectInput, setShowRejectInput] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const [expandedSteps, setExpandedSteps] = useState(false)

  const selectedApproach = approaches.find(a => a.id === selectedId)

  const handleApprove = () => {
    if (selectedId) {
      onApprove(selectedId)
    }
  }

  const handleReject = () => {
    if (showRejectInput) {
      onReject(rejectReason || undefined)
      setShowRejectInput(false)
      setRejectReason('')
    } else {
      setShowRejectInput(true)
    }
  }

  return (
    <div className="p-5 bg-black rounded border border-orange-500/30">
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <span className="text-orange-400 text-lg">◆</span>
        <span className="text-orange-400 uppercase tracking-widest text-sm font-medium">
          Select Approach
        </span>
        <span className="text-gray-500 text-xs ml-auto">
          {approaches.length} option{approaches.length > 1 ? 's' : ''}
        </span>
      </div>

      {/* Approach tabs */}
      <div className="flex gap-2 mb-4">
        {approaches.map((approach) => (
          <button
            key={approach.id}
            onClick={() => setSelectedId(approach.id)}
            className={`
              flex-1 p-3 rounded border transition-all text-left
              ${selectedId === approach.id
                ? 'border-orange-400 bg-orange-900/20'
                : 'border-gray-700 bg-gray-900/30 hover:border-gray-500'
              }
            `}
          >
            <div className="flex items-center gap-2">
              <span className={`text-sm font-medium ${selectedId === approach.id ? 'text-orange-300' : 'text-gray-300'}`}>
                {approach.name}
              </span>
              {recommendedApproachId === approach.id && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-900/50 text-green-400 border border-green-700/50">
                  REC
                </span>
              )}
            </div>
            <div className="text-[10px] text-gray-500 mt-1">
              {approach.plan.length} step{approach.plan.length > 1 ? 's' : ''}
            </div>
          </button>
        ))}
      </div>

      {/* Selected approach details */}
      {selectedApproach && (
        <div className="space-y-4">
          {/* Summary */}
          <div className="p-3 bg-gray-900/50 rounded border border-gray-800">
            <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Summary</div>
            <p className="text-gray-300 text-sm leading-relaxed">{selectedApproach.summary}</p>
          </div>

          {/* Plan steps (collapsible) */}
          <div className="border border-gray-800 rounded overflow-hidden">
            <button
              onClick={() => setExpandedSteps(!expandedSteps)}
              className="w-full p-3 bg-gray-900/50 flex items-center justify-between hover:bg-gray-900/70 transition-colors"
            >
              <span className="text-[10px] text-gray-500 uppercase tracking-wider">
                Implementation Steps ({selectedApproach.plan.length})
              </span>
              <span className="text-gray-500 text-xs">
                {expandedSteps ? '▼' : '▶'}
              </span>
            </button>

            {expandedSteps && (
              <div className="p-3 space-y-2 max-h-60 overflow-y-auto">
                {selectedApproach.plan.map((step, index) => (
                  <PlanStepItem key={step.id} step={step} index={index} />
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Reject reason input */}
      {showRejectInput && (
        <div className="mt-4 p-3 bg-gray-900/50 rounded border border-gray-800">
          <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-2">
            Feedback (optional)
          </div>
          <textarea
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="Explain what you'd like changed..."
            className="w-full bg-black border border-gray-700 rounded p-2 text-sm text-gray-300 placeholder-gray-600 focus:border-orange-500 focus:outline-none resize-none"
            rows={2}
          />
        </div>
      )}

      {/* Action buttons */}
      <div className="flex gap-3 mt-4">
        <button
          onClick={handleApprove}
          disabled={!selectedId}
          className={`
            flex-1 py-2.5 px-4 rounded border text-sm uppercase tracking-wider font-medium transition-all
            ${selectedId
              ? 'bg-green-900/30 border-green-500/50 text-green-400 hover:bg-green-900/50'
              : 'bg-gray-900/30 border-gray-700 text-gray-500 cursor-not-allowed'
            }
          `}
        >
          Approve{selectedApproach ? `: ${selectedApproach.name}` : ''}
        </button>
        <button
          onClick={handleReject}
          className="py-2.5 px-4 rounded border border-red-500/50 bg-red-900/20 text-red-400 text-sm uppercase tracking-wider font-medium hover:bg-red-900/40 transition-all"
        >
          {showRejectInput ? 'Submit' : 'Reject'}
        </button>
        {showRejectInput && (
          <button
            onClick={() => {
              setShowRejectInput(false)
              setRejectReason('')
            }}
            className="py-2.5 px-4 rounded border border-gray-700 bg-gray-900/30 text-gray-400 text-sm uppercase tracking-wider font-medium hover:bg-gray-900/50 transition-all"
          >
            Cancel
          </button>
        )}
      </div>
    </div>
  )
}

function PlanStepItem({ step, index }: { step: PlanStep; index: number }) {
  return (
    <div className="flex gap-3 p-2 bg-gray-900/30 rounded border border-gray-800/50">
      <div className="flex-shrink-0 w-5 h-5 rounded-full bg-orange-900/30 border border-orange-700/50 flex items-center justify-center">
        <span className="text-[10px] text-orange-400">{index + 1}</span>
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm text-gray-300 font-medium">{step.title}</div>
        <div className="text-[10px] text-gray-500 mt-0.5 line-clamp-2">{step.description}</div>
        {step.files.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1.5">
            {step.files.slice(0, 3).map((file, i) => (
              <span key={i} className="text-[9px] px-1.5 py-0.5 bg-gray-800 rounded text-gray-400">
                {file.split('/').pop()}
              </span>
            ))}
            {step.files.length > 3 && (
              <span className="text-[9px] text-gray-500">+{step.files.length - 3} more</span>
            )}
          </div>
        )}
      </div>
      {step.complexity && (
        <div className={`
          text-[9px] px-1.5 py-0.5 rounded self-start
          ${step.complexity === 'low' ? 'bg-green-900/30 text-green-400' : ''}
          ${step.complexity === 'medium' ? 'bg-yellow-900/30 text-yellow-400' : ''}
          ${step.complexity === 'high' ? 'bg-red-900/30 text-red-400' : ''}
        `}>
          {step.complexity}
        </div>
      )}
    </div>
  )
}
