export interface Metric {
    name: string;
    command: string;
    weight: number;
    target: number;
    higherIsBetter?: boolean;
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
export type ProviderType = 'anthropic' | 'openrouter' | 'openai';
export interface Provider {
    type: ProviderType;
    apiKey?: string;
    model?: string;
    baseUrl?: string;
}
export interface PolishConfig {
    metrics: Metric[];
    target: number;
    maxIterations: number;
    provider?: Provider;
}
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
export interface PolishResult {
    initialScore: ScoreResult;
    finalScore: ScoreResult;
    iterations: number;
    commits: string[];
    reason: 'target_reached' | 'plateau' | 'max_iterations' | 'error';
}
export type ToolName = 'read_file' | 'write_file' | 'edit_file' | 'bash' | 'glob' | 'grep' | 'list_dir';
export interface ToolResult {
    success: boolean;
    output?: string;
    error?: string;
}
