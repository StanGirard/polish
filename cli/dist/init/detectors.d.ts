import type { StackInfo } from '../types.js';
/**
 * Detect the project stack (language, runtime, tools)
 */
export declare function detectStack(cwd?: string): Promise<StackInfo>;
/**
 * Get a human-readable summary of the detected stack
 */
export declare function getStackSummary(stack: StackInfo): string;
