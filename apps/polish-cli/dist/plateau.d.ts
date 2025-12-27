import type { PolishState } from './state.js';
import type { ScoreResult } from './types.js';
export interface PlateauDecision {
    shouldStop: boolean;
    reason: string;
}
export type PlateauDetectionMode = 'stalled' | 'llm';
/**
 * Detect if we've hit a plateau and should stop
 *
 * 'stalled' mode: Simple counter-based detection
 * 'llm' mode: Uses LLM to make intelligent decision (via prompt-based hook)
 */
export declare function detectPlateau(state: PolishState, currentScore: ScoreResult, target: number, mode?: PlateauDetectionMode): PlateauDecision;
/**
 * Build context for LLM-based plateau detection
 * This is used when the hook is configured with type: "prompt"
 */
export declare function buildPlateauContext(state: PolishState, currentScore: ScoreResult, target: number): string;
