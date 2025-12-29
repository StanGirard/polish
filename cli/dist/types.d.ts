export interface ScoringConfig {
    type: 'binary' | 'percentage' | 'count-inverse' | 'custom' | 'agent';
    pattern?: string;
    maxCount?: number;
    formula?: string;
    agentId?: string;
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
}
