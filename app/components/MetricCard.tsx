'use client'

import type { MetricResult } from '@/lib/types'

interface MetricCardProps {
  metric: MetricResult
  isFixing?: boolean
}

export function MetricCard({ metric, isFixing }: MetricCardProps) {
  const { name, rawValue, normalizedScore, target, higherIsBetter } = metric

  // Create ASCII progress bar
  const width = 20
  const filled = Math.round((normalizedScore / 100) * width)
  const empty = width - filled
  const bar = '\u2588'.repeat(filled) + '\u2591'.repeat(empty)

  // Format value display
  const valueDisplay = higherIsBetter
    ? `${rawValue}%`
    : `${rawValue} errors`

  // Status indicator
  const isComplete = normalizedScore >= 100
  const status = isComplete ? '\u2713' : isFixing ? '\u25B6 FIXING' : '\u25CB'

  // Color based on score
  const getColor = () => {
    if (normalizedScore >= 80) return 'text-green-400'
    if (normalizedScore >= 50) return 'text-yellow-400'
    return 'text-red-400'
  }

  // Hex representation of score
  const hexScore = Math.round(normalizedScore).toString(16).toUpperCase().padStart(2, '0')

  return (
    <div className={`font-mono flex items-center gap-3 text-xs p-2 rounded border border-gray-900 ${
      isFixing ? 'bg-blue-900/10 border-blue-700/30 data-stream' : 'bg-gray-900/20'
    }`}>
      <div className="flex items-center gap-2 w-36">
        <span className={`${isComplete ? 'text-green-500' : isFixing ? 'text-blue-400 blink' : 'text-gray-600'}`}>
          {status}
        </span>
        <span className="text-gray-300 uppercase tracking-wider">{name}</span>
      </div>
      <span className={`${getColor()} tracking-tight flex-1`}>{bar}</span>
      <div className="flex flex-col items-end">
        <span className="text-gray-400 font-bold">{valueDisplay}</span>
        <span className="text-[9px] text-gray-700 tracking-widest">0x{hexScore}</span>
      </div>
      <div className="text-gray-600 text-[10px] w-16 text-right">
        {normalizedScore.toFixed(0)}/100
      </div>
    </div>
  )
}

interface MetricsGridProps {
  metrics: MetricResult[]
  currentStrategy?: string
}

export function MetricsGrid({ metrics, currentStrategy }: MetricsGridProps) {
  return (
    <div className="space-y-1">
      {metrics.map(metric => (
        <MetricCard
          key={metric.name}
          metric={metric}
          isFixing={currentStrategy === metric.name}
        />
      ))}
    </div>
  )
}

export default MetricCard
