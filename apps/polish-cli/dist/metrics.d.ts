import type { Metric, MetricResult, ScoreResult } from './types.js';
/**
 * Run a single metric and return its score
 */
export declare function runMetric(metric: Metric): Promise<MetricResult>;
/**
 * Calculate total score from all metrics
 */
export declare function calculateScore(metrics: Metric[]): Promise<ScoreResult>;
/**
 * Find the worst performing metric
 */
export declare function findWorstMetric(score: ScoreResult): MetricResult;
