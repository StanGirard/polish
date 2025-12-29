/**
 * Agent Runner
 *
 * Uses Claude Agent SDK to run AI-powered code analysis agents.
 */
import { query } from '@anthropic-ai/claude-agent-sdk';
import { DRY_PROMPT } from './dry.js';
// Agent prompts registry
const agentPrompts = {
    dry: DRY_PROMPT,
};
/**
 * Get the prompt for a specific agent
 */
function getAgentPrompt(agentId) {
    const prompt = agentPrompts[agentId];
    if (!prompt) {
        throw new Error(`Unknown agent: ${agentId}. Available agents: ${Object.keys(agentPrompts).join(', ')}`);
    }
    return prompt;
}
/**
 * Parse agent response to extract pass/fail and findings
 */
function parseAgentResponse(response) {
    // Extract JSON from response (may have markdown code blocks)
    const jsonMatch = response.match(/```json\s*([\s\S]*?)\s*```/) || response.match(/(\{[\s\S]*\})/);
    if (!jsonMatch) {
        return { pass: false, findings: 'Agent failed to produce valid output' };
    }
    try {
        const parsed = JSON.parse(jsonMatch[1]);
        return {
            pass: Boolean(parsed.pass),
            findings: String(parsed.findings || ''),
        };
    }
    catch {
        return { pass: false, findings: 'Failed to parse agent response' };
    }
}
/**
 * Run an AI agent by ID
 */
export async function runAgent(agentId) {
    const prompt = getAgentPrompt(agentId);
    let result = '';
    for await (const message of query({
        prompt,
        options: {
            cwd: process.cwd(),
            allowedTools: ['Read', 'Glob', 'Grep', 'Bash'],
            permissionMode: 'bypassPermissions',
            settingSources: ['project', 'local'], // Inherit MCP servers & config
            maxTurns: 20,
        },
    })) {
        if (message.type === 'result' && message.subtype === 'success') {
            result = message.result;
        }
    }
    return parseAgentResponse(result);
}
/**
 * Get list of available agent IDs
 */
export function getAvailableAgents() {
    return Object.keys(agentPrompts);
}
