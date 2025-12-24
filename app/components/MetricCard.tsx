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
  const status = isComplete ? '\u2713' : isFixing ? '\u2190 fixing' : ''

  // Color based on score
  const getColor = () => {
    if (normalizedScore >= 80) return 'text-green-400'
    if (normalizedScore >= 50) return 'text-yellow-400'
    return 'text-red-400'
  }

  return (
    <div className="font-mono flex items-center gap-4 text-sm">
      <span className="w-32 text-gray-300">{name}</span>
      <span className={`${getColor()} tracking-tight`}>{bar}</span>
      <span className="w-24 text-gray-400 text-right">{valueDisplay}</span>
      <span className={`w-20 ${isComplete ? 'text-green-400' : isFixing ? 'text-blue-400' : 'text-gray-600'}`}>
        {status}
      </span>
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
