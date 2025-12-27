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
export interface HookConfig {
    plateauDetection?: 'stalled' | 'llm';
}
export interface PolishConfig {
    metrics: Metric[];
    target: number;
    maxIterations: number;
    hook?: HookConfig;
}
