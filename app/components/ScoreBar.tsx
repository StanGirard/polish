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

  // Convert score to hex for techy display
  const hexScore = Math.round(score).toString(16).toUpperCase().padStart(2, '0')

  // Score color based on value
  const getScoreColor = () => {
    if (score >= 90) return 'text-cyan-400 glow-cyan'
    if (score >= 70) return 'text-green-400 glow-green'
    if (score >= 50) return 'text-yellow-400'
    return 'text-red-400'
  }

  return (
    <div className="font-mono space-y-2">
      <div className="flex items-center gap-4">
        <div className="flex flex-col">
          <span className={`text-3xl font-bold ${getScoreColor()}`}>
            {score.toFixed(0)}<span className="text-sm text-gray-600">/100</span>
          </span>
          <span className="text-xs text-gray-600 tracking-widest">
            0x{hexScore} <span className="text-gray-700">|</span> {(score / 100 * 255).toFixed(0)}/255
          </span>
        </div>
        <div className="flex-1 relative data-stream">
          <div className="text-lg tracking-tight text-gray-500">{bar}</div>
          <div className="text-[10px] text-gray-700 mt-0.5 tracking-widest">
            [{filled}/{width}] <span className="text-gray-800">BLOCKS</span>
          </div>
        </div>
        {deltaStr && (
          <div className="flex flex-col items-end">
            <span className={`text-xl font-bold ${delta! >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {delta! >= 0 ? '▲' : '▼'} {deltaStr}
            </span>
            <span className="text-xs text-gray-600">DELTA</span>
          </div>
        )}
      </div>
    </div>
  )
}

export default ScoreBar
