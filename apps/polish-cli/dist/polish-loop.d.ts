import type { PolishConfig, PolishResult, ScoreResult } from './types.js';
export interface PolishLoopCallbacks {
    onScore?: (score: ScoreResult) => void;
    onIteration?: (iteration: number) => void;
    onImproving?: (metricName: string | null) => void;
    onAgentText?: (text: string) => void;
    onAgentTool?: (tool: string) => void;
    onAgentToolDone?: () => void;
    onCommit?: (hash: string) => void;
    onRollback?: () => void;
}
/**
 * Run the polish loop to iteratively improve code quality
 */
export declare function runPolishLoop(config: PolishConfig): Promise<PolishResult>;
/**
 * Run the polish loop with callbacks for UI integration
 */
export declare function runPolishLoopWithCallback(config: PolishConfig, callbacks: PolishLoopCallbacks): Promise<PolishResult>;
/**
 * Display final results
 */
export declare function displayResults(result: PolishResult): void;
