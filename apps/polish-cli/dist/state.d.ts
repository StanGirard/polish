import type { ScoreResult } from './types.js';
export interface PolishState {
    iteration: number;
    scores: number[];
    lastImprovement: number;
    stalledCount: number;
    worktreePath: string | null;
    startedAt: string;
    lastUpdated: string;
}
/**
 * Get the path to the state file
 */
export declare function getStatePath(cwd?: string): string;
/**
 * Load state from disk, or create initial state
 */
export declare function loadState(cwd?: string): Promise<PolishState>;
/**
 * Create initial state for a new polish session
 */
export declare function createInitialState(): PolishState;
/**
 * Save state to disk
 */
export declare function saveState(state: PolishState, cwd?: string): Promise<void>;
/**
 * Reset state (clear the file)
 */
export declare function resetState(cwd?: string): Promise<void>;
/**
 * Update state with new score and return whether we improved
 */
export declare function updateStateWithScore(state: PolishState, score: ScoreResult): boolean;
/**
 * Get the previous score from state
 */
export declare function getPreviousScore(state: PolishState): number;
/**
 * Check if we have initial score recorded
 */
export declare function hasInitialScore(state: PolishState): boolean;
