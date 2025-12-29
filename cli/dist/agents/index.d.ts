/**
 * Agent Runner
 *
 * Uses Claude Agent SDK to run AI-powered code analysis agents.
 */
export interface AgentResult {
    pass: boolean;
    findings: string;
}
/**
 * Run an AI agent by ID
 */
export declare function runAgent(agentId: string): Promise<AgentResult>;
/**
 * Get list of available agent IDs
 */
export declare function getAvailableAgents(): string[];
