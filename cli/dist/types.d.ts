export interface ScoringConfig {
    type: 'binary' | 'percentage' | 'count-inverse' | 'custom';
    pattern?: string;
    maxCount?: number;
    formula?: string;
}
export interface Metric {
    name: string;
    command: string;
    weight: number;
    target: number;
    higherIsBetter?: boolean;
    scoring?: ScoringConfig;
}
export interface MetricResult {
    name: string;
    score: number;
    target: number;
    weight: number;
    raw?: string;
}
export interface ScoreResult {
    total: number;
    metrics: MetricResult[];
}
export interface HookConfig {
    plateauDetection?: 'stalled' | 'llm';
}
export interface PolishConfig {
    metrics: Metric[];
    target: number;
    maxIterations: number;
    hook?: HookConfig;
    commands?: CustomCommand[];
}
export interface Verification {
    name: string;
    description?: string;
    category?: string;
    languages?: string[] | 'universal';
    command: string;
    paths?: string[];
    scoring?: ScoringConfig;
    dependencies?: Record<string, string>;
    weight: number;
    target: number;
    setup?: {
        command: string;
        condition?: string;
    };
}
export interface StackInfo {
    language: 'javascript' | 'typescript' | 'python' | 'rust' | 'go' | 'java' | 'unknown';
    runtime?: 'node' | 'bun' | 'deno';
    framework?: string;
    tools: DetectedTool[];
}
export interface DetectedTool {
    category: 'tests' | 'lint' | 'types' | 'format' | 'quality' | 'security' | 'build';
    name: string;
    confidence: 'high' | 'medium' | 'low';
    verification: string;
    command?: string;
}
export interface BankEntry {
    path: string;
    verification: Verification;
}
export interface CustomCommand {
    name: string;
    description: string;
    command: string;
    category?: 'test' | 'lint' | 'format' | 'build' | 'security' | 'quality' | 'other';
}
export interface CommandResult {
    name: string;
    success: boolean;
    exitCode: number;
    stdout: string;
    stderr: string;
    duration: number;
}
