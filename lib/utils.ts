/**
 * Utility functions for Polish
 */

/**
 * Clamp a number between min and max values
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

/**
 * Format a number as a percentage string
 */
export function formatPercentage(value: number, decimals: number = 1): string {
  return `${value.toFixed(decimals)}%`
}

/**
 * Calculate weighted average
 */
export function weightedAverage(values: Array<{ value: number; weight: number }>): number {
  if (values.length === 0) return 0

  const totalWeight = values.reduce((sum, item) => sum + item.weight, 0)
  if (totalWeight === 0) return 0

  const weightedSum = values.reduce((sum, item) => sum + item.value * item.weight, 0)
  return weightedSum / totalWeight
}

/**
 * Truncate a string to a maximum length, adding ellipsis if needed
 */
export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str
  return str.slice(0, maxLength - 3) + '...'
}

/**
 * Check if a string is a valid GitHub repository URL
 */
export function isGitHubUrl(url: string): boolean {
  return url.includes('github.com') && (url.startsWith('git@') || url.startsWith('https://'))
}

/**
 * Parse a duration in milliseconds to a human-readable string
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
  if (ms < 3600000) return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`
  return `${Math.floor(ms / 3600000)}h ${Math.floor((ms % 3600000) / 60000)}m`
}

/**
 * Check if a score has improved by at least a minimum threshold
 */
export function hasImproved(oldScore: number, newScore: number, minImprovement: number = 0.5): boolean {
  return newScore - oldScore >= minImprovement
}

/**
 * Normalize a score to 0-100 range for higherIsBetter metrics
 */
export function normalizeHigherIsBetter(value: number, target: number): number {
  if (target <= 0) return 0
  const normalized = (value / target) * 100
  return clamp(normalized, 0, 100)
}

/**
 * Normalize a score to 0-100 range for lowerIsBetter metrics
 */
export function normalizeLowerIsBetter(value: number, target: number): number {
  if (target === 0) {
    // Special case: target is 0, use exponential decay
    return clamp(100 - value * 2, 0, 100)
  }
  // Standard case: normalize based on target
  const normalized = 100 - (value / target) * 100
  return clamp(normalized, 0, 100)
}
