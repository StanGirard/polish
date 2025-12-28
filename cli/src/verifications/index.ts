import { loadVerifications } from './loader.js';
import { evaluateConditions } from './conditions.js';
import type { Verification } from './types.js';
import type { Metric, ScoringConfig as MetricScoringConfig } from '../types.js';

export type { Verification, Condition, ScoringConfig } from './types.js';

let cachedVerifications: Verification[] | null = null;

/**
 * Get all verifications (cached)
 */
export function getAllVerifications(): Verification[] {
  if (!cachedVerifications) {
    cachedVerifications = loadVerifications();
  }
  return cachedVerifications;
}

/**
 * Get verifications that match the current project
 */
export async function getMatchingVerifications(
  cwd: string = process.cwd()
): Promise<Verification[]> {
  const all = getAllVerifications();
  const matching: Verification[] = [];

  for (const verification of all) {
    if (verification.conditions.length === 0) {
      // No conditions means always match
      matching.push(verification);
    } else if (await evaluateConditions(verification.conditions, cwd)) {
      matching.push(verification);
    }
  }

  return matching;
}

/**
 * Get a verification by ID
 */
export function getVerification(id: string): Verification | undefined {
  return getAllVerifications().find(v => v.id === id);
}

/**
 * Convert verification to metric for polish.config.json
 */
export function verificationToMetric(verification: Verification): Metric {
  const metric: Metric = {
    name: verification.id,
    command: verification.command,
    weight: verification.weight,
    target: verification.target,
  };

  // Convert scoring config if not binary
  if (verification.scoring.type === 'regex') {
    metric.scoring = {
      type: 'custom',
      pattern: verification.scoring.pattern,
    } as MetricScoringConfig;
  }

  return metric;
}

/**
 * Clear cached verifications (for testing)
 */
export function clearCache(): void {
  cachedVerifications = null;
}
