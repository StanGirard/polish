// Metric configuration
export interface Metric {
  name: string;
  command: string;
  weight: number;
  target: number;
  higherIsBetter?: boolean; // default true
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

// Provider configuration
export type ProviderType = 'anthropic' | 'openrouter' | 'openai';

export interface Provider {
  type: ProviderType;
  apiKey?: string; // If not provided, uses env var
  model?: string; // Model override
  baseUrl?: string; // Custom API endpoint (e.g., https://api.z.ai/api/anthropic)
}

// Configuration file (polish.config.json)
export interface PolishConfig {
  metrics: Metric[];
  target: number; // target score to reach
  maxIterations: number;
  provider?: Provider;
}

// CLI options
export interface CliOptions {
  target: string;
  maxIterations: string;
  polish: boolean;
  polishOnly: boolean;
  config: string;
  provider?: string;
  model?: string;
  baseUrl?: string;
}

// Polish loop result
export interface PolishResult {
  initialScore: ScoreResult;
  finalScore: ScoreResult;
  iterations: number;
  commits: string[];
  reason: 'target_reached' | 'plateau' | 'max_iterations' | 'error';
}

// Tool definitions for Claude
export type ToolName =
  | 'read_file'
  | 'write_file'
  | 'edit_file'
  | 'bash'
  | 'glob'
  | 'grep'
  | 'list_dir';

export interface ToolResult {
  success: boolean;
  output?: string;
  error?: string;
}
