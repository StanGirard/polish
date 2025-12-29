/**
 * Condition for when to recommend a verification
 */
export interface FileExistsCondition {
    fileExists: string;
}
export interface FileContainsCondition {
    fileContains: {
        path: string;
        pattern: string;
    };
}
export interface AnyOfCondition {
    anyOf: Condition[];
}
export type Condition = FileExistsCondition | FileContainsCondition | AnyOfCondition;
/**
 * Scoring configuration
 */
export interface BinaryScoring {
    type: 'binary';
}
export interface RegexScoring {
    type: 'regex';
    pattern: string;
    perMatch: number;
}
/**
 * Agent scoring configuration
 */
export interface AgentScoring {
    type: 'agent';
    agentId: string;
}
export type ScoringConfig = BinaryScoring | RegexScoring | AgentScoring;
/**
 * Verification definition from YAML
 */
export interface Verification {
    id: string;
    name: string;
    description: string;
    category: 'tests' | 'lint' | 'types' | 'build' | 'security' | 'quality' | 'agents';
    command: string;
    conditions: Condition[];
    scoring: ScoringConfig;
    weight: number;
    target: number;
    onError?: string;
}
