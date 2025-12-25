'use client'

import { useState } from 'react'
import type { Session, SessionFeedback } from '@/lib/session-store'

interface FeedbackPanelProps {
  session: Session
  onRetry: (feedback: string) => Promise<void>
  onFeedbackSubmit: (rating: 'satisfied' | 'unsatisfied', comment?: string) => Promise<void>
}

export function FeedbackPanel({ session, onRetry, onFeedbackSubmit }: FeedbackPanelProps) {
  const [feedback, setFeedback] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [mode, setMode] = useState<'feedback' | 'retry' | null>(null)

  const hasFeedback = session.feedback !== undefined

  const handleSatisfied = async () => {
    setIsSubmitting(true)
    try {
      await onFeedbackSubmit('satisfied')
      setSubmitted(true)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleRetry = async () => {
    if (!feedback.trim()) return
    setIsSubmitting(true)
    try {
      await onRetry(feedback)
    } finally {
      setIsSubmitting(false)
    }
  }

  // Si on a déjà donné un feedback et qu'on est satisfait
  if (hasFeedback && session.feedback?.rating === 'satisfied') {
    return (
      <div className="p-5 bg-black rounded border border-green-500/30 relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-green-400 to-transparent" />
        <div className="flex items-center gap-3">
          <span className="text-green-400 text-2xl">✓</span>
          <div>
            <div className="text-green-400 text-sm font-bold">Merci pour votre retour !</div>
            <div className="text-green-700 text-xs">Session marquée comme satisfaisante</div>
          </div>
        </div>
      </div>
    )
  }

  // Si on est satisfait
  if (submitted) {
    return (
      <div className="p-5 bg-black rounded border border-green-500/30 relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-green-400 to-transparent" />
        <div className="flex items-center gap-3">
          <span className="text-green-400 text-2xl">✓</span>
          <div>
            <div className="text-green-400 text-sm font-bold">Merci pour votre retour !</div>
            <div className="text-green-700 text-xs">Votre feedback a été enregistré</div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-5 bg-black rounded border border-orange-500/30 relative overflow-hidden">
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-orange-400 to-transparent" />

      <div className="text-orange-400 text-xs mb-4 uppercase tracking-widest flex items-center gap-2">
        <span>◆</span> Feedback
        {session.retryCount > 0 && (
          <span className="text-orange-600 text-[10px]">
            (Tentative #{session.retryCount + 1})
          </span>
        )}
      </div>

      {/* Question initiale */}
      {mode === null && (
        <div>
          <div className="text-gray-300 text-sm mb-4">
            Êtes-vous satisfait du résultat de cette session ?
          </div>
          <div className="flex gap-3">
            <button
              onClick={handleSatisfied}
              disabled={isSubmitting}
              className="flex-1 px-4 py-3 bg-green-900/30 hover:bg-green-900/50 border border-green-600 text-green-400 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span className="text-lg mr-2">✓</span>
              <span className="font-bold">Oui, satisfait</span>
            </button>
            <button
              onClick={() => setMode('retry')}
              disabled={isSubmitting}
              className="flex-1 px-4 py-3 bg-orange-900/30 hover:bg-orange-900/50 border border-orange-600 text-orange-400 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span className="text-lg mr-2">↻</span>
              <span className="font-bold">Non, réessayer</span>
            </button>
          </div>
        </div>
      )}

      {/* Mode retry - demander le feedback */}
      {mode === 'retry' && (
        <div>
          <div className="text-gray-300 text-sm mb-3">
            Décrivez ce qui ne va pas et ce que vous aimeriez changer :
          </div>
          <textarea
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            placeholder="Ex: Le bouton devrait être rouge au lieu de vert, la fonction manque de gestion d'erreur..."
            className="w-full h-32 px-4 py-3 bg-black/50 border border-orange-800 rounded text-gray-200 placeholder-gray-600 focus:border-orange-500 focus:outline-none resize-none font-mono text-sm"
            disabled={isSubmitting}
          />
          <div className="flex gap-3 mt-3">
            <button
              onClick={() => setMode(null)}
              disabled={isSubmitting}
              className="px-4 py-2 text-gray-500 hover:text-gray-300 transition-colors"
            >
              ← Retour
            </button>
            <button
              onClick={handleRetry}
              disabled={isSubmitting || !feedback.trim()}
              className="flex-1 px-4 py-2 bg-orange-600/30 hover:bg-orange-600/50 border border-orange-500 text-orange-300 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-bold"
            >
              {isSubmitting ? (
                <span className="animate-pulse">Relance en cours...</span>
              ) : (
                <>
                  <span className="mr-2">↻</span>
                  Relancer avec ce feedback
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
