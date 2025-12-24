import { describe, it, expect } from 'vitest'
import {
  clamp,
  formatPercentage,
  weightedAverage,
  truncate,
  isGitHubUrl,
  formatDuration,
  hasImproved,
  normalizeHigherIsBetter,
  normalizeLowerIsBetter
} from '../utils'

describe('clamp', () => {
  it('should return value when within range', () => {
    expect(clamp(5, 0, 10)).toBe(5)
    expect(clamp(50, 0, 100)).toBe(50)
  })

  it('should return min when value is below min', () => {
    expect(clamp(-5, 0, 10)).toBe(0)
    expect(clamp(5, 10, 20)).toBe(10)
  })

  it('should return max when value is above max', () => {
    expect(clamp(15, 0, 10)).toBe(10)
    expect(clamp(150, 0, 100)).toBe(100)
  })

  it('should handle equal min and max', () => {
    expect(clamp(5, 10, 10)).toBe(10)
    expect(clamp(15, 10, 10)).toBe(10)
  })

  it('should handle negative ranges', () => {
    expect(clamp(-5, -10, -1)).toBe(-5)
    expect(clamp(-15, -10, -1)).toBe(-10)
    expect(clamp(0, -10, -1)).toBe(-1)
  })
})

describe('formatPercentage', () => {
  it('should format with default 1 decimal place', () => {
    expect(formatPercentage(50)).toBe('50.0%')
    expect(formatPercentage(75.5)).toBe('75.5%')
  })

  it('should format with specified decimal places', () => {
    expect(formatPercentage(50, 0)).toBe('50%')
    expect(formatPercentage(75.567, 2)).toBe('75.57%')
    expect(formatPercentage(99.999, 3)).toBe('99.999%')
  })

  it('should handle zero', () => {
    expect(formatPercentage(0)).toBe('0.0%')
    expect(formatPercentage(0, 0)).toBe('0%')
  })

  it('should handle 100', () => {
    expect(formatPercentage(100)).toBe('100.0%')
    expect(formatPercentage(100, 2)).toBe('100.00%')
  })
})

describe('weightedAverage', () => {
  it('should calculate weighted average correctly', () => {
    const values = [
      { value: 100, weight: 50 },
      { value: 50, weight: 50 }
    ]
    expect(weightedAverage(values)).toBe(75)
  })

  it('should handle different weights', () => {
    const values = [
      { value: 100, weight: 75 },
      { value: 0, weight: 25 }
    ]
    expect(weightedAverage(values)).toBe(75)
  })

  it('should return 0 for empty array', () => {
    expect(weightedAverage([])).toBe(0)
  })

  it('should return 0 when total weight is 0', () => {
    const values = [
      { value: 100, weight: 0 },
      { value: 50, weight: 0 }
    ]
    expect(weightedAverage(values)).toBe(0)
  })

  it('should handle single value', () => {
    const values = [{ value: 42, weight: 100 }]
    expect(weightedAverage(values)).toBe(42)
  })

  it('should handle fractional weights', () => {
    const values = [
      { value: 80, weight: 0.5 },
      { value: 60, weight: 0.5 }
    ]
    expect(weightedAverage(values)).toBe(70)
  })
})

describe('truncate', () => {
  it('should not truncate when string is shorter than maxLength', () => {
    expect(truncate('hello', 10)).toBe('hello')
    expect(truncate('test', 10)).toBe('test')
  })

  it('should not truncate when string equals maxLength', () => {
    expect(truncate('hello', 5)).toBe('hello')
  })

  it('should truncate and add ellipsis when too long', () => {
    expect(truncate('hello world', 8)).toBe('hello...')
    expect(truncate('this is a long string', 10)).toBe('this is...')
  })

  it('should handle empty string', () => {
    expect(truncate('', 10)).toBe('')
  })

  it('should handle very short maxLength', () => {
    expect(truncate('hello', 3)).toBe('...')
    expect(truncate('hello world', 5)).toBe('he...')
  })
})

describe('isGitHubUrl', () => {
  it('should recognize valid HTTPS GitHub URLs', () => {
    expect(isGitHubUrl('https://github.com/owner/repo')).toBe(true)
    expect(isGitHubUrl('https://github.com/owner/repo.git')).toBe(true)
  })

  it('should recognize valid SSH GitHub URLs', () => {
    expect(isGitHubUrl('git@github.com:owner/repo.git')).toBe(true)
    expect(isGitHubUrl('git@github.com:owner/repo')).toBe(true)
  })

  it('should reject non-GitHub URLs', () => {
    expect(isGitHubUrl('https://gitlab.com/owner/repo')).toBe(false)
    expect(isGitHubUrl('https://bitbucket.org/owner/repo')).toBe(false)
  })

  it('should reject invalid formats', () => {
    expect(isGitHubUrl('github.com/owner/repo')).toBe(false)
    expect(isGitHubUrl('not a url')).toBe(false)
    expect(isGitHubUrl('')).toBe(false)
  })

  it('should handle authenticated URLs', () => {
    expect(isGitHubUrl('https://token@github.com/owner/repo.git')).toBe(true)
  })
})

describe('formatDuration', () => {
  it('should format milliseconds', () => {
    expect(formatDuration(500)).toBe('500ms')
    expect(formatDuration(999)).toBe('999ms')
  })

  it('should format seconds', () => {
    expect(formatDuration(1000)).toBe('1.0s')
    expect(formatDuration(5500)).toBe('5.5s')
    expect(formatDuration(59999)).toBe('60.0s')
  })

  it('should format minutes and seconds', () => {
    expect(formatDuration(60000)).toBe('1m 0s')
    expect(formatDuration(90000)).toBe('1m 30s')
    expect(formatDuration(125000)).toBe('2m 5s')
  })

  it('should format hours and minutes', () => {
    expect(formatDuration(3600000)).toBe('1h 0m')
    expect(formatDuration(5400000)).toBe('1h 30m')
    expect(formatDuration(7325000)).toBe('2h 2m')
  })

  it('should handle zero', () => {
    expect(formatDuration(0)).toBe('0ms')
  })
})

describe('hasImproved', () => {
  it('should return true when improvement meets threshold', () => {
    expect(hasImproved(50, 51, 0.5)).toBe(true)
    expect(hasImproved(50, 55, 0.5)).toBe(true)
  })

  it('should return false when improvement is below threshold', () => {
    expect(hasImproved(50, 50.4, 0.5)).toBe(false)
    expect(hasImproved(50, 50, 0.5)).toBe(false)
  })

  it('should return false when score decreased', () => {
    expect(hasImproved(50, 49, 0.5)).toBe(false)
    expect(hasImproved(50, 40, 0.5)).toBe(false)
  })

  it('should use default threshold of 0.5', () => {
    expect(hasImproved(50, 50.5)).toBe(true)
    expect(hasImproved(50, 50.4)).toBe(false)
  })

  it('should handle custom thresholds', () => {
    expect(hasImproved(50, 51, 1.0)).toBe(true)
    expect(hasImproved(50, 50.9, 1.0)).toBe(false)
    expect(hasImproved(50, 50.1, 0.1)).toBe(true)
  })

  it('should handle negative scores', () => {
    expect(hasImproved(-10, -9, 0.5)).toBe(true)
    expect(hasImproved(-10, -10.4, 0.5)).toBe(false)
  })
})

describe('normalizeHigherIsBetter', () => {
  it('should normalize value relative to target', () => {
    expect(normalizeHigherIsBetter(50, 100)).toBe(50)
    expect(normalizeHigherIsBetter(75, 100)).toBe(75)
    expect(normalizeHigherIsBetter(100, 100)).toBe(100)
  })

  it('should cap at 100 when value exceeds target', () => {
    expect(normalizeHigherIsBetter(150, 100)).toBe(100)
    expect(normalizeHigherIsBetter(200, 100)).toBe(100)
  })

  it('should handle zero value', () => {
    expect(normalizeHigherIsBetter(0, 100)).toBe(0)
  })

  it('should return 0 when target is 0', () => {
    expect(normalizeHigherIsBetter(50, 0)).toBe(0)
  })

  it('should return 0 when target is negative', () => {
    expect(normalizeHigherIsBetter(50, -10)).toBe(0)
  })

  it('should handle fractional values', () => {
    expect(normalizeHigherIsBetter(42.5, 100)).toBe(42.5)
    expect(normalizeHigherIsBetter(99.9, 100)).toBe(99.9)
  })
})

describe('normalizeLowerIsBetter', () => {
  it('should normalize when target is not zero', () => {
    expect(normalizeLowerIsBetter(5, 10)).toBe(50)
    expect(normalizeLowerIsBetter(0, 10)).toBe(100)
    expect(normalizeLowerIsBetter(10, 10)).toBe(0)
  })

  it('should use exponential decay when target is 0', () => {
    expect(normalizeLowerIsBetter(0, 0)).toBe(100)
    expect(normalizeLowerIsBetter(10, 0)).toBe(80)
    expect(normalizeLowerIsBetter(50, 0)).toBe(0)
  })

  it('should cap at 0 for very high values with target 0', () => {
    expect(normalizeLowerIsBetter(100, 0)).toBe(0)
    expect(normalizeLowerIsBetter(1000, 0)).toBe(0)
  })

  it('should cap at 0 when value exceeds target', () => {
    expect(normalizeLowerIsBetter(20, 10)).toBe(0)
    expect(normalizeLowerIsBetter(15, 10)).toBe(0)
  })

  it('should cap at 100', () => {
    expect(normalizeLowerIsBetter(0, 10)).toBe(100)
    expect(normalizeLowerIsBetter(-5, 10)).toBe(100)
  })

  it('should handle fractional values', () => {
    expect(normalizeLowerIsBetter(2.5, 10)).toBe(75)
    expect(normalizeLowerIsBetter(7.5, 10)).toBe(25)
  })
})
