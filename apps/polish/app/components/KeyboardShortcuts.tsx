'use client'

import { useEffect } from 'react'

interface KeyboardShortcutsProps {
  onNewSession?: () => void
  onRefresh?: () => void
  onCloseModal?: () => void
}

export function KeyboardShortcuts({
  onNewSession,
  onRefresh,
  onCloseModal
}: KeyboardShortcutsProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl/Cmd + N - New Session
      if ((e.metaKey || e.ctrlKey) && e.key === 'n') {
        e.preventDefault()
        onNewSession?.()
      }

      // Ctrl/Cmd + R - Refresh
      if ((e.metaKey || e.ctrlKey) && e.key === 'r') {
        e.preventDefault()
        onRefresh?.()
      }

      // Escape - Close Modal
      if (e.key === 'Escape') {
        onCloseModal?.()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onNewSession, onRefresh, onCloseModal])

  return null // This component only handles keyboard events
}

export default KeyboardShortcuts
