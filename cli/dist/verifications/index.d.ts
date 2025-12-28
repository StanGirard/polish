import type { Verification } from './types.js';
import type { Metric } from '../types.js';
export type { Verification, Condition, ScoringConfig } from './types.js';
/**
 * Get all verifications (cached)
 */
export declare function getAllVerifications(): Verification[];
/**
 * Get verifications that match the current project
 */
export declare function getMatchingVerifications(cwd?: string): Promise<Verification[]>;
/**
 * Get a verification by ID
 */
export declare function getVerification(id: string): Verification | undefined;
/**
 * Convert verification to metric for polish.config.json
 */
export declare function verificationToMetric(verification: Verification): Metric;
/**
 * Clear cached verifications (for testing)
 */
export declare function clearCache(): void;
