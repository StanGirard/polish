import { readFile } from 'fs/promises'
import { join } from 'path'
import { exec } from './executor'
import type { Metric, MetricResult, Preset, ScoreResult, Strategy } from './types'

// ============================================================================
// Preset Loading
// ============================================================================

const PRESETS_DIR = join(process.cwd(), 'presets')

async function loadPresetFile(name: string): Promise<Preset> {
  const filePath = join(PRESETS_DIR, `${name}.json`)
  const content = await readFile(filePath, 'utf-8')
  return JSON.parse(content) as Preset
}

export async function loadPreset(cwd: string): Promise<Preset> {
  // For now, always use nextjs preset since Polish is a Next.js project
  // TODO: Auto-detect stack based on package.json, config files, etc.
  const preset = await loadPresetFile('nextjs')

  // Load base preset if extends
  if (preset.extends) {
    const base = await loadPresetFile(preset.extends)
    return {
      ...base,
      ...preset,
      rules: [...(base.rules || []), ...(preset.rules || [])],
      metrics: preset.metrics || base.metrics,
      strategies: preset.strategies || base.strategies,
      thresholds: {
        minImprovement: preset.thresholds?.minImprovement ?? base.thresholds?.minImprovement,
        maxStalled: preset.thresholds?.maxStalled ?? base.thresholds?.maxStalled,
        maxScore: preset.thresholds?.maxScore ?? base.thresholds?.maxScore
      }
    }
  }

  return preset
}

// ============================================================================
// Metric Execution
// ============================================================================

export async function runMetric(metric: Metric, cwd: string): Promise<MetricResult> {
  const result = await exec(metric.command, cwd, 60000)

  // Parse raw value from stdout
  let rawValue = 0
  try {
    const trimmed = result.stdout.trim()
    rawValue = parseFloat(trimmed) || 0
  } catch {
    rawValue = 0
  }

  // Normalize to 0-100 score
  let normalizedScore: number

  if (metric.higherIsBetter) {
    // For metrics like coverage, testsPassing: higher is better
    // score = (value / target) * 100, capped at 100
    normalizedScore = Math.min(100, (rawValue / metric.target) * 100)
  } else {
    // For metrics like lintErrors, typeErrors: lower is better
    // score = max(0, 100 - value * factor)
    // If target is 0, we use a factor based on reasonable max
    if (metric.target === 0) {
      // Assume 50 errors = 0 score
      normalizedScore = Math.max(0, 100 - rawValue * 2)
    } else {
      // score decreases as value exceeds target
      normalizedScore = Math.max(0, 100 - (rawValue / metric.target) * 100)
    }
  }

  return {
    name: metric.name,
    rawValue,
    normalizedScore,
    weight: metric.weight,
    target: metric.target,
    higherIsBetter: metric.higherIsBetter
  }
}

export async function runAllMetrics(metrics: Metric[], cwd: string): Promise<MetricResult[]> {
  // Run metrics in parallel for speed
  const results = await Promise.all(
    metrics.map(metric => runMetric(metric, cwd))
  )
  return results
}

// ============================================================================
// Score Calculation
// ============================================================================

export function calculateScore(metrics: MetricResult[]): ScoreResult {
  const totalWeight = metrics.reduce((sum, m) => sum + m.weight, 0)

  if (totalWeight === 0) {
    return { score: 0, metrics }
  }

  const weightedSum = metrics.reduce(
    (sum, m) => sum + m.normalizedScore * m.weight,
    0
  )

  const score = weightedSum / totalWeight

  return {
    score: Math.round(score * 10) / 10, // Round to 1 decimal
    metrics
  }
}

// ============================================================================
// Strategy Selection
// ============================================================================

export function getWorstMetric(metrics: MetricResult[]): MetricResult | null {
  if (metrics.length === 0) return null

  // Find the metric with the lowest normalized score
  // Weight by importance: worse score AND higher weight = higher priority
  return metrics.reduce((worst, current) => {
    const worstPriority = (100 - worst.normalizedScore) * worst.weight
    const currentPriority = (100 - current.normalizedScore) * current.weight
    return currentPriority > worstPriority ? current : worst
  })
}

export function getStrategyForMetric(
  metricName: string,
  strategies: Strategy[]
): Strategy | null {
  return strategies.find(s => s.focus === metricName) || null
}

// ============================================================================
// Scoring Pipeline
// ============================================================================

export async function scoreProject(cwd: string): Promise<ScoreResult> {
  const preset = await loadPreset(cwd)

  if (!preset.metrics || preset.metrics.length === 0) {
    return { score: 100, metrics: [] }
  }

  const metricResults = await runAllMetrics(preset.metrics, cwd)
  return calculateScore(metricResults)
}

export async function getNextStrategy(
  cwd: string,
  excludeStrategies: string[] = []
): Promise<{ strategy: Strategy; targetMetric: MetricResult } | null> {
  const preset = await loadPreset(cwd)

  if (!preset.metrics || !preset.strategies) {
    return null
  }

  const metricResults = await runAllMetrics(preset.metrics, cwd)

  // Sort metrics by priority (worst first)
  const sortedMetrics = [...metricResults].sort((a, b) => {
    const priorityA = (100 - a.normalizedScore) * a.weight
    const priorityB = (100 - b.normalizedScore) * b.weight
    return priorityB - priorityA
  })

  // Find a strategy for the worst metric that hasn't been excluded
  for (const metric of sortedMetrics) {
    const strategy = getStrategyForMetric(metric.name, preset.strategies)
    if (strategy && !excludeStrategies.includes(strategy.name)) {
      return { strategy, targetMetric: metric }
    }
  }

  return null
}
