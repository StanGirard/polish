import { exec } from './executor'
import type { Config, Metric, ScoreResult } from './types'

interface MetricResult {
  rawValue: number | string
  normalizedScore: number
  diagnostic: string
}

function normalizeScore(value: number, metric: Metric): number {
  if (metric.higherIsBetter) {
    // For higher-is-better metrics: score = (value / target) * 100, capped at 100
    if (metric.target === 0) return value === 0 ? 100 : 0
    return Math.min(100, (value / metric.target) * 100)
  } else {
    // For lower-is-better metrics: score = 100 - (value / target) * 100, floored at 0
    if (metric.target === 0) return value === 0 ? 100 : Math.max(0, 100 - value * 10)
    return Math.max(0, 100 - (value / metric.target) * 100)
  }
}

async function evaluateMetric(metric: Metric, projectPath: string): Promise<MetricResult> {
  try {
    const result = await exec(metric.command, projectPath, 30000)
    const output = result.stdout.trim()

    // Try to parse as number
    const numValue = parseFloat(output)
    const value = isNaN(numValue) ? 0 : numValue

    const score = normalizeScore(value, metric)

    // Generate diagnostic
    let diagnostic = ''
    if (score < 80) {
      if (metric.higherIsBetter) {
        diagnostic = `${metric.name}: ${value} (target: ${metric.target}). Need to increase.`
      } else {
        diagnostic = `${metric.name}: ${value} (target: ${metric.target}). Need to reduce.`
      }
    }

    return {
      rawValue: value,
      normalizedScore: score,
      diagnostic,
    }
  } catch (error) {
    // If command fails, return worst score
    return {
      rawValue: 'error',
      normalizedScore: 0,
      diagnostic: `${metric.name}: Failed to evaluate (${error instanceof Error ? error.message : 'unknown error'})`,
    }
  }
}

export async function calculateScore(config: Config, projectPath: string): Promise<ScoreResult> {
  const details: Record<string, number> = {}
  const values: Record<string, number | string> = {}
  const diagnostics: Record<string, string> = {}

  let totalWeightedScore = 0
  let totalWeight = 0

  // Evaluate all metrics in parallel
  const results = await Promise.all(
    config.metrics.map(async (metric) => ({
      metric,
      result: await evaluateMetric(metric, projectPath),
    }))
  )

  for (const { metric, result } of results) {
    details[metric.name] = result.normalizedScore
    values[metric.name] = result.rawValue
    if (result.diagnostic) {
      diagnostics[metric.name] = result.diagnostic
    }

    totalWeightedScore += result.normalizedScore * metric.weight
    totalWeight += metric.weight
  }

  const total = totalWeight > 0 ? totalWeightedScore / totalWeight : 0

  return {
    total,
    details,
    values,
    diagnostics,
  }
}

export function findWorstMetric(score: ScoreResult, config: Config): string | null {
  let worstMetric: string | null = null
  let worstRelativeScore = Infinity

  for (const metric of config.metrics) {
    const metricScore = score.details[metric.name] ?? 100
    // Relative score = score / weight (lower means more impactful to fix)
    const relativeScore = metricScore / metric.weight

    if (relativeScore < worstRelativeScore) {
      worstRelativeScore = relativeScore
      worstMetric = metric.name
    }
  }

  return worstMetric
}

export function selectStrategy(
  score: ScoreResult,
  config: Config,
  currentIndex: number
): { strategy: typeof config.strategies[0]; index: number } | null {
  if (config.strategies.length === 0) return null

  // Find the metric with the worst relative score
  const worstMetric = findWorstMetric(score, config)
  if (!worstMetric) return null

  // Find strategy targeting this metric
  const strategyIndex = config.strategies.findIndex((s) => s.focus === worstMetric)
  if (strategyIndex !== -1) {
    return {
      strategy: config.strategies[strategyIndex],
      index: strategyIndex,
    }
  }

  // Fallback to next strategy in rotation
  const nextIndex = (currentIndex + 1) % config.strategies.length
  return {
    strategy: config.strategies[nextIndex],
    index: nextIndex,
  }
}
