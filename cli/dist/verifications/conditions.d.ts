import type { Condition } from './types.js';
/**
 * Evaluate a single condition against a directory
 */
export declare function evaluateCondition(condition: Condition, cwd: string): Promise<boolean>;
/**
 * Evaluate all conditions (AND logic)
 */
export declare function evaluateConditions(conditions: Condition[], cwd: string): Promise<boolean>;
