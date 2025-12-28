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

// Verification definition (YAML bank format)
export interface Verification {
  name: string;
  description?: string;
  category?: string; // tests, lint, types, security, quality, etc.
  languages?: string[] | 'universal'; // Languages this applies to
  command: string;
  paths?: string[]; // Default paths if not auto-detected
  scoring?: ScoringConfig;
  dependencies?: Record<string, string>; // Package manager -> package name
  weight: number;
  target: number;
  setup?: {
    command: string;
    condition?: string; // e.g., "!exists:node_modules"
  };
}

// Detected stack information
export interface StackInfo {
  language: 'javascript' | 'typescript' | 'python' | 'rust' | 'go' | 'java' | 'unknown';
  runtime?: 'node' | 'bun' | 'deno';
  framework?: string;
  tools: DetectedTool[];
}

// Detected tool in the project
export interface DetectedTool {
  category: 'tests' | 'lint' | 'types' | 'format' | 'quality' | 'security' | 'build';
  name: string;
  confidence: 'high' | 'medium' | 'low';
  verification: string; // Bank reference (e.g., "javascript/tests/bun")
  command?: string; // Override command if detected
}

// Bank entry for listing
export interface BankEntry {
  path: string;
  verification: Verification;
}
