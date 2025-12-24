import { describe, it, expect, vi } from 'vitest'
import { calculateScore, getWorstMetric, runMetric, getStrategyForMetric } from '../scorer'
import type { MetricResult, Metric, Strategy } from '../types'
import * as executor from '../executor'

describe('calculateScore', () => {
  it('should return 0 when no metrics', () => {
    const result = calculateScore([])
    expect(result.score).toBe(0)
  })

  it('should calculate weighted average correctly', () => {
    const metrics: MetricResult[] = [
      { name: 'test1', rawValue: 0, normalizedScore: 100, weight: 50, target: 0, higherIsBetter: false },
      { name: 'test2', rawValue: 0, normalizedScore: 50, weight: 50, target: 0, higherIsBetter: false }
    ]
    const result = calculateScore(metrics)
    expect(result.score).toBe(75)
  })

  it('should handle different weights', () => {
    const metrics: MetricResult[] = [
      { name: 'test1', rawValue: 0, normalizedScore: 100, weight: 75, target: 0, higherIsBetter: false },
      { name: 'test2', rawValue: 0, normalizedScore: 0, weight: 25, target: 0, higherIsBetter: false }
    ]
    const result = calculateScore(metrics)
    expect(result.score).toBe(75)
  })
})

describe('getWorstMetric', () => {
  it('should return null for empty array', () => {
    const result = getWorstMetric([])
    expect(result).toBeNull()
  })

  it('should return metric with highest priority (worst score * weight)', () => {
    const metrics: MetricResult[] = [
      { name: 'good', rawValue: 0, normalizedScore: 100, weight: 50, target: 0, higherIsBetter: false },
      { name: 'bad', rawValue: 5, normalizedScore: 50, weight: 50, target: 0, higherIsBetter: false }
    ]
    const result = getWorstMetric(metrics)
    expect(result?.name).toBe('bad')
  })

  it('should prioritize high weight metrics', () => {
    const metrics: MetricResult[] = [
      { name: 'low-weight-bad', rawValue: 10, normalizedScore: 0, weight: 10, target: 0, higherIsBetter: false },
      { name: 'high-weight-ok', rawValue: 2, normalizedScore: 80, weight: 90, target: 0, higherIsBetter: false }
    ]
    const result = getWorstMetric(metrics)
    // (100 - 80) * 90 = 1800 vs (100 - 0) * 10 = 1000
    expect(result?.name).toBe('high-weight-ok')
  })
})

describe('runMetric', () => {
  it('should normalize higherIsBetter metrics correctly', async () => {
    vi.spyOn(executor, 'exec').mockResolvedValue({ stdout: '75', stderr: '', exitCode: 0 })

    const metric: Metric = {
      name: 'testCoverage',
      command: 'echo 75',
      target: 100,
      weight: 50,
      higherIsBetter: true
    }

    const result = await runMetric(metric, '/test/dir')
    expect(result.rawValue).toBe(75)
    expect(result.normalizedScore).toBe(75) // (75 / 100) * 100 = 75
  })

  it('should cap higherIsBetter metrics at 100', async () => {
    vi.spyOn(executor, 'exec').mockResolvedValue({ stdout: '150', stderr: '', exitCode: 0 })

    const metric: Metric = {
      name: 'testCoverage',
      command: 'echo 150',
      target: 100,
      weight: 50,
      higherIsBetter: true
    }

    const result = await runMetric(metric, '/test/dir')
    expect(result.rawValue).toBe(150)
    expect(result.normalizedScore).toBe(100) // Capped at 100
  })

  it('should normalize lowerIsBetter metrics with target 0', async () => {
    vi.spyOn(executor, 'exec').mockResolvedValue({ stdout: '10', stderr: '', exitCode: 0 })

    const metric: Metric = {
      name: 'lintErrors',
      command: 'echo 10',
      target: 0,
      weight: 50,
      higherIsBetter: false
    }

    const result = await runMetric(metric, '/test/dir')
    expect(result.rawValue).toBe(10)
    expect(result.normalizedScore).toBe(80) // 100 - (10 * 2) = 80
  })

  it('should normalize lowerIsBetter metrics with non-zero target', async () => {
    vi.spyOn(executor, 'exec').mockResolvedValue({ stdout: '5', stderr: '', exitCode: 0 })

    const metric: Metric = {
      name: 'buildTime',
      command: 'echo 5',
      target: 10,
      weight: 50,
      higherIsBetter: false
    }

    const result = await runMetric(metric, '/test/dir')
    expect(result.rawValue).toBe(5)
    expect(result.normalizedScore).toBe(50) // 100 - (5/10)*100 = 50
  })

  it('should handle parse errors and default to 0', async () => {
    vi.spyOn(executor, 'exec').mockResolvedValue({ stdout: 'invalid', stderr: '', exitCode: 0 })

    const metric: Metric = {
      name: 'testCoverage',
      command: 'echo invalid',
      target: 100,
      weight: 50,
      higherIsBetter: true
    }

    const result = await runMetric(metric, '/test/dir')
    expect(result.rawValue).toBe(0)
    expect(result.normalizedScore).toBe(0)
  })

  it('should trim whitespace from stdout', async () => {
    vi.spyOn(executor, 'exec').mockResolvedValue({ stdout: '  42.5  \n', stderr: '', exitCode: 0 })

    const metric: Metric = {
      name: 'testCoverage',
      command: 'echo 42.5',
      target: 100,
      weight: 50,
      higherIsBetter: true
    }

    const result = await runMetric(metric, '/test/dir')
    expect(result.rawValue).toBe(42.5)
    expect(result.normalizedScore).toBe(42.5)
  })
})

describe('getStrategyForMetric', () => {
  it('should return matching strategy', () => {
    const strategies: Strategy[] = [
      { name: 'fix-lint', focus: 'lintErrors', description: 'Fix lint', weight: 50 },
      { name: 'add-tests', focus: 'testCoverage', description: 'Add tests', weight: 50 }
    ]

    const result = getStrategyForMetric('testCoverage', strategies)
    expect(result?.name).toBe('add-tests')
  })

  it('should return null when no match', () => {
    const strategies: Strategy[] = [
      { name: 'fix-lint', focus: 'lintErrors', description: 'Fix lint', weight: 50 }
    ]

    const result = getStrategyForMetric('testCoverage', strategies)
    expect(result).toBeNull()
  })

  it('should return null for empty strategies array', () => {
    const result = getStrategyForMetric('testCoverage', [])
    expect(result).toBeNull()
  })
})
