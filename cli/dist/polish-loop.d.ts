import type { PolishConfig, PolishResult, ScoreResult } from './types.js';
export interface PolishLoopCallbacks {
    onScore?: (score: ScoreResult) => void;
    onIteration?: (iteration: number) => void;
    onImproving?: (metricName: string | null) => void;
    onAgentText?: (text: string) => void;
    onAgentToolStart?: (id: string, name: string, displayText: string) => void;
    onAgentToolDone?: (id: string, success: boolean, output?: string, error?: string, duration?: number) => void;
    onAgentTool?: (tool: string) => void;
    onAgentToolLegacyDone?: () => void;
    onCommit?: (hash: string) => void;
    onRollback?: () => void;
}
export interface PolishLoopOptions {
    worktreePath?: string;
}
/**
 * Run the polish loop to iteratively improve code quality
 */
export declare function runPolishLoop(config: PolishConfig): Promise<PolishResult>;
/**
 * Run the polish loop with callbacks for UI integration
 */
export declare function runPolishLoopWithCallback(config: PolishConfig, callbacks: PolishLoopCallbacks, options?: PolishLoopOptions): Promise<PolishResult>;
/**
 * Display final results
 */
export declare function displayResults(result: PolishResult): void;
