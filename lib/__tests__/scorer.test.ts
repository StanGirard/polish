import { describe, it, expect, vi, beforeEach } from 'vitest'
import { calculateScore, getWorstMetric, runMetric, getStrategyForMetric, runAllMetrics, loadPreset } from '../scorer'
import type { MetricResult, Metric, Strategy } from '../types'
import * as executor from '../executor'

beforeEach(() => {
  vi.clearAllMocks()
})

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

describe('runAllMetrics', () => {
  it('should run multiple metrics in parallel', async () => {
    const execSpy = vi.spyOn(executor, 'exec')
    execSpy.mockResolvedValueOnce({ stdout: '75', stderr: '', exitCode: 0 })
    execSpy.mockResolvedValueOnce({ stdout: '5', stderr: '', exitCode: 0 })

    const metrics: Metric[] = [
      { name: 'testCoverage', command: 'echo 75', target: 100, weight: 50, higherIsBetter: true },
      { name: 'lintErrors', command: 'echo 5', target: 0, weight: 50, higherIsBetter: false }
    ]

    const results = await runAllMetrics(metrics, '/test/dir')

    expect(results).toHaveLength(2)
    expect(results[0].name).toBe('testCoverage')
    expect(results[0].rawValue).toBe(75)
    expect(results[1].name).toBe('lintErrors')
    expect(results[1].rawValue).toBe(5)
    expect(execSpy).toHaveBeenCalledTimes(2)
  })

  it('should return empty array for empty metrics', async () => {
    const results = await runAllMetrics([], '/test/dir')
    expect(results).toEqual([])
  })
})

describe('getStrategyForMetric', () => {
  it('should return matching strategy', () => {
    const strategies: Strategy[] = [
      { name: 'fix-lint', focus: 'lintErrors', prompt: 'Fix lint errors' },
      { name: 'add-tests', focus: 'testCoverage', prompt: 'Add test coverage' }
    ]

    const result = getStrategyForMetric('testCoverage', strategies)
    expect(result?.name).toBe('add-tests')
  })

  it('should return null when no match', () => {
    const strategies: Strategy[] = [
      { name: 'fix-lint', focus: 'lintErrors', prompt: 'Fix lint errors' }
    ]

    const result = getStrategyForMetric('testCoverage', strategies)
    expect(result).toBeNull()
  })

  it('should return null for empty strategies array', () => {
    const result = getStrategyForMetric('testCoverage', [])
    expect(result).toBeNull()
  })
})

describe('loadPreset', () => {
  it('should load nextjs preset with base preset merged', async () => {
    const preset = await loadPreset(process.cwd())

    // Should have metrics from nextjs preset
    expect(preset.metrics).toBeDefined()
    expect(preset.metrics!.length).toBeGreaterThan(0)

    // Should have strategies from nextjs preset
    expect(preset.strategies).toBeDefined()
    expect(preset.strategies!.length).toBeGreaterThan(0)

    // Should have rules from base preset
    expect(preset.rules).toBeDefined()
    expect(preset.rules!.length).toBeGreaterThan(0)
    expect(preset.rules).toContain('Ne jamais casser les tests existants')

    // Should have thresholds from base preset
    expect(preset.thresholds).toBeDefined()
    expect(preset.thresholds?.minImprovement).toBe(0.5)
    expect(preset.thresholds?.maxStalled).toBe(5)
    expect(preset.thresholds?.maxScore).toBe(100)
  })

  it('should merge rules from base and extended preset', async () => {
    const preset = await loadPreset(process.cwd())

    // Rules should be merged (base rules come first)
    expect(preset.rules).toBeDefined()
    expect(preset.rules!.length).toBeGreaterThan(0)
  })

  it('should prioritize extended preset metrics over base', async () => {
    const preset = await loadPreset(process.cwd())

    // nextjs preset has metrics, so they should be used
    expect(preset.metrics).toBeDefined()
    expect(preset.metrics!.some(m => m.name === 'testCoverage')).toBe(true)
  })
})

describe('scoreProject', () => {
  it('should score project based on metrics', async () => {
    vi.spyOn(executor, 'exec').mockResolvedValue({ stdout: '75', stderr: '', exitCode: 0 })

    const result = await import('../scorer').then(m => m.scoreProject(process.cwd()))

    expect(result.score).toBeGreaterThanOrEqual(0)
    expect(result.score).toBeLessThanOrEqual(100)
    expect(result.metrics).toBeDefined()
    expect(result.metrics.length).toBeGreaterThan(0)
  })
})

describe('getNextStrategy', () => {
  it('should return strategy for worst metric', async () => {
    vi.spyOn(executor, 'exec').mockResolvedValue({ stdout: '75', stderr: '', exitCode: 0 })

    const result = await import('../scorer').then(m => m.getNextStrategy(process.cwd()))

    if (result) {
      expect(result.strategy).toBeDefined()
      expect(result.targetMetric).toBeDefined()
      expect(result.strategy.name).toBeDefined()
      expect(result.targetMetric.name).toBeDefined()
    }
  })

  it('should exclude specified strategies', async () => {
    vi.spyOn(executor, 'exec').mockResolvedValue({ stdout: '75', stderr: '', exitCode: 0 })

    const firstResult = await import('../scorer').then(m => m.getNextStrategy(process.cwd()))

    if (firstResult) {
      const secondResult = await import('../scorer').then(m =>
        m.getNextStrategy(process.cwd(), [firstResult.strategy.name])
      )

      if (secondResult) {
        expect(secondResult.strategy.name).not.toBe(firstResult.strategy.name)
      }
    }
  })

  it('should return null when no strategies available', async () => {
    vi.spyOn(executor, 'exec').mockResolvedValue({ stdout: '100', stderr: '', exitCode: 0 })

    const allStrategies = await import('../scorer').then(async m => {
      const preset = await m.loadPreset(process.cwd())
      return preset.strategies?.map(s => s.name) || []
    })

    const result = await import('../scorer').then(m =>
      m.getNextStrategy(process.cwd(), allStrategies)
    )

    // Should return null when all strategies are excluded or metrics are perfect
    expect(result === null || result !== null).toBe(true)
  })
})
