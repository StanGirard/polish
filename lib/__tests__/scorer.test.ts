import { describe, it, expect } from 'vitest'
import { calculateScore, getWorstMetric } from '../scorer'
import type { MetricResult } from '../types'

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
