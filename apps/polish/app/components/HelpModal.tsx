'use client'

import { useState, useEffect } from 'react'

export function HelpModal() {
  const [isOpen, setIsOpen] = useState(false)

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === '?' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault()
        setIsOpen(prev => !prev)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-4 right-4 z-30 w-10 h-10 rounded-full bg-green-900/50 border border-green-500/50 text-green-400 hover:bg-green-900/70 hover:scale-110 transition-all flex items-center justify-center text-lg font-bold"
        title="Keyboard shortcuts (press ?)"
      >
        ?
      </button>
    )
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-black border border-green-500/30 rounded max-w-2xl w-full max-h-[80vh] overflow-y-auto box-glow">
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6 pb-4 border-b border-green-900/30">
            <h2 className="text-2xl font-bold text-green-400 glow-green flex items-center gap-2">
              <span>⌨</span> KEYBOARD SHORTCUTS
            </h2>
            <button
              onClick={() => setIsOpen(false)}
              className="text-gray-500 hover:text-green-400 transition-colors text-2xl"
            >
              ✕
            </button>
          </div>

          {/* Content */}
          <div className="space-y-6 font-mono">
            {/* Navigation */}
            <section>
              <h3 className="text-green-400 text-sm uppercase tracking-widest mb-3">Navigation</h3>
              <div className="space-y-2">
                <ShortcutItem keys={['Esc']} description="Close modal or dialog" />
                <ShortcutItem keys={['?']} description="Toggle this help menu" />
                <ShortcutItem keys={['Ctrl/Cmd', 'R']} description="Refresh sessions" />
              </div>
            </section>

            {/* Features */}
            <section>
              <h3 className="text-cyan-400 text-sm uppercase tracking-widest mb-3">Features</h3>
              <div className="space-y-2 text-gray-400 text-xs">
                <FeatureItem icon="🔍" title="Search Sessions" description="Filter by mission, ID, or branch name" />
                <FeatureItem icon="📊" title="Stats Overview" description="View success rate and performance metrics" />
                <FeatureItem icon="🔔" title="Toast Notifications" description="Get real-time feedback on actions" />
                <FeatureItem icon="📈" title="Sort Sessions" description="Sort by newest, oldest, score, or commits" />
              </div>
            </section>

            {/* Tips */}
            <section>
              <h3 className="text-yellow-400 text-sm uppercase tracking-widest mb-3">Tips</h3>
              <div className="space-y-2 text-gray-400 text-xs">
                <TipItem tip="Use Extended Thinking for complex tasks requiring more reasoning" />
                <TipItem tip="Enable Planning Mode to review the implementation plan before execution" />
                <TipItem tip="Auto-refresh is enabled by default when sessions are running" />
                <TipItem tip="Click on any session card to view detailed metrics and logs" />
              </div>
            </section>
          </div>

          {/* Footer */}
          <div className="mt-6 pt-4 border-t border-green-900/30 text-center">
            <p className="text-[10px] text-gray-600 tracking-widest">
              POLISH.RUN v0.2.0 | Press <kbd className="px-2 py-1 bg-gray-800 rounded text-green-400">?</kbd> to toggle
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

function ShortcutItem({ keys, description }: { keys: string[]; description: string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <div className="flex items-center gap-2">
        {keys.map((key, i) => (
          <kbd
            key={i}
            className="px-2 py-1 bg-gray-900 border border-gray-700 rounded text-green-400 text-xs font-mono"
          >
            {key}
          </kbd>
        ))}
      </div>
      <span className="text-gray-400 text-xs">{description}</span>
    </div>
  )
}

function FeatureItem({ icon, title, description }: { icon: string; title: string; description: string }) {
  return (
    <div className="flex items-start gap-3 p-2 rounded hover:bg-gray-900/30 transition-colors">
      <span className="text-lg">{icon}</span>
      <div>
        <div className="text-gray-300 font-semibold">{title}</div>
        <div className="text-gray-500">{description}</div>
      </div>
    </div>
  )
}

function TipItem({ tip }: { tip: string }) {
  return (
    <div className="flex items-start gap-2 p-2 rounded hover:bg-gray-900/30 transition-colors">
      <span className="text-yellow-500 text-xs">▸</span>
      <span className="text-gray-400">{tip}</span>
    </div>
  )
}

export default HelpModal
