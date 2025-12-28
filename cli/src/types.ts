// Scoring configuration for metrics
export interface ScoringConfig {
  type: 'binary' | 'percentage' | 'count-inverse' | 'custom';
  pattern?: string; // Regex pattern to extract value
  maxCount?: number; // For count-inverse: count at which score = 0
  formula?: string; // For custom: expression to calculate score
}

// Metric configuration
export interface Metric {
  name: string;
  command: string;
  weight: number;
  target: number;
  higherIsBetter?: boolean; // default true
  scoring?: ScoringConfig; // Explicit scoring strategy (optional for backward compat)
}

// Metric result after running command
export interface MetricResult {
  name: string;
  score: number; // 0-100
  target: number;
  weight: number;
  raw?: string; // raw output
}

// Overall score
export interface ScoreResult {
  total: number; // weighted average 0-100
  metrics: MetricResult[];
}

// Hook configuration for Claude Code integration
export interface HookConfig {
  plateauDetection?: 'stalled' | 'llm'; // How to detect plateau
}

// Configuration file (polish.config.json)
export interface PolishConfig {
  metrics: Metric[];
  target: number; // target score to reach
  maxIterations: number;
  hook?: HookConfig;
}
