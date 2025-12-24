'use client'

interface ScoreBarProps {
  score: number
  initialScore?: number
  width?: number
}

export function ScoreBar({ score, initialScore, width = 24 }: ScoreBarProps) {
  const filled = Math.round((score / 100) * width)
  const empty = width - filled
  const bar = '\u2588'.repeat(filled) + '\u2591'.repeat(empty)

  const delta = initialScore !== undefined ? score - initialScore : null
  const deltaStr = delta !== null
    ? delta >= 0
      ? `+${delta.toFixed(1)}`
      : delta.toFixed(1)
    : null

  return (
    <div className="font-mono">
      <div className="flex items-center gap-4">
        <span className="text-2xl font-bold text-white">
          {score.toFixed(0)}/100
        </span>
        <span className="text-gray-400 tracking-tight">{bar}</span>
        {deltaStr && (
          <span className={delta! >= 0 ? 'text-green-400' : 'text-red-400'}>
            ({deltaStr} pts)
          </span>
        )}
      </div>
    </div>
  )
}

export default ScoreBar
