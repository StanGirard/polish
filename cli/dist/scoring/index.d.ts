import type { ScoringConfig } from '../types.js';
export interface ScoringStrategy {
    type: string;
    parse(output: string, exitCode: number, config: ScoringConfig): number;
}
export declare function registerStrategy(strategy: ScoringStrategy): void;
export declare function parseScoreWithStrategy(output: string, exitCode: number, config: ScoringConfig): number;
export declare const binaryStrategy: ScoringStrategy;
export declare const percentageStrategy: ScoringStrategy;
export declare const countInverseStrategy: ScoringStrategy;
export declare const customStrategy: ScoringStrategy;
