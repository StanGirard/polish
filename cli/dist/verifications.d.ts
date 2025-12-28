import type { Metric } from './types.js';
/**
 * Verification definition with metadata for display
 */
export interface VerificationDef {
    name: string;
    description: string;
    command: string;
    weight: number;
    target: number;
    details?: string;
}
/**
 * Built-in verifications registry
 */
export declare const VERIFICATIONS: Record<string, VerificationDef>;
/**
 * Get all verification names
 */
export declare function getVerificationNames(): string[];
/**
 * Get a verification by name
 */
export declare function getVerification(name: string): VerificationDef | undefined;
/**
 * Convert a verification definition to a metric config
 */
export declare function verificationToMetric(def: VerificationDef, overrides?: {
    command?: string;
    weight?: number;
    target?: number;
}): Metric;
/**
 * Get verification command customized for runtime
 */
export declare function getVerificationCommand(name: string, runtime?: 'bun' | 'node' | 'deno'): string;
