'use client'

import { useState } from 'react'
import type { PlanQuestion } from '@/lib/types'

interface QuestionPanelProps {
  question: PlanQuestion
  onAnswer: (optionId: string) => void
  isSubmitting: boolean
}

export function QuestionPanel({
  question,
  onAnswer,
  isSubmitting
}: QuestionPanelProps) {
  const [selectedId, setSelectedId] = useState<string>(
    question.recommended || ''
  )

  const handleSubmit = () => {
    if (selectedId) {
      onAnswer(selectedId)
    }
  }

  return (
    <div className="p-5 bg-black rounded border border-orange-500/30 relative overflow-hidden">
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-orange-400 to-transparent" />

      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <span className="text-orange-400 text-lg">?</span>
        <span className="text-orange-400 uppercase tracking-widest text-sm font-medium">
          Question
        </span>
      </div>

      {/* Question text */}
      <div className="mb-6">
        <p className="text-gray-200 text-base leading-relaxed">
          {question.text}
        </p>
      </div>

      {/* Options */}
      <div className="space-y-2 mb-6">
        {question.options.map((option) => {
          const isSelected = selectedId === option.id
          const isRecommended = question.recommended === option.id

          return (
            <button
              key={option.id}
              onClick={() => setSelectedId(option.id)}
              disabled={isSubmitting}
              className={`
                w-full p-4 rounded border transition-all text-left
                ${isSelected
                  ? 'border-orange-400 bg-orange-900/30'
                  : 'border-gray-700 bg-gray-900/30 hover:border-gray-500'
                }
                ${isSubmitting ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
              `}
            >
              <div className="flex items-start gap-3">
                {/* Radio indicator */}
                <div className={`
                  flex-shrink-0 w-5 h-5 rounded-full border-2 mt-0.5
                  flex items-center justify-center
                  ${isSelected
                    ? 'border-orange-400 bg-orange-900/50'
                    : 'border-gray-600'
                  }
                `}>
                  {isSelected && (
                    <div className="w-2 h-2 rounded-full bg-orange-400" />
                  )}
                </div>

                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className={`font-medium ${isSelected ? 'text-orange-300' : 'text-gray-300'}`}>
                      {option.label}
                    </span>
                    {isRecommended && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-900/50 text-green-400 border border-green-700/50">
                        Recommand&eacute;
                      </span>
                    )}
                  </div>
                  {option.description && (
                    <p className="text-gray-500 text-sm mt-1">
                      {option.description}
                    </p>
                  )}
                </div>
              </div>
            </button>
          )
        })}
      </div>

      {/* Submit button */}
      <button
        onClick={handleSubmit}
        disabled={!selectedId || isSubmitting}
        className={`
          w-full py-3 px-4 rounded border text-sm uppercase tracking-wider font-medium transition-all
          ${selectedId && !isSubmitting
            ? 'bg-orange-900/30 border-orange-500/50 text-orange-400 hover:bg-orange-900/50'
            : 'bg-gray-900/30 border-gray-700 text-gray-500 cursor-not-allowed'
          }
        `}
      >
        {isSubmitting ? (
          <span className="flex items-center justify-center gap-2">
            <span className="animate-spin">&#x25CC;</span>
            Envoi...
          </span>
        ) : (
          'Valider ma r&eacute;ponse'
        )}
      </button>
    </div>
  )
}
