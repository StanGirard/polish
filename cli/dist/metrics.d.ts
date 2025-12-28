import type { Metric, MetricResult, ScoreResult } from './types.js';
/**
 * Run a single metric and return its score
 */
export declare function runMetric(metric: Metric): Promise<MetricResult>;
/**
 * Calculate total score from all metrics
 * @param metrics - Array of metrics to run
 * @param onMetricComplete - Optional callback called after each metric completes
 */
export declare function calculateScore(metrics: Metric[], onMetricComplete?: (result: MetricResult) => void): Promise<ScoreResult>;
/**
 * Find the worst performing metric
 */
export declare function findWorstMetric(score: ScoreResult): MetricResult;
