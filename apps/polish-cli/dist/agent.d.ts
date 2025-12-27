import type { Provider } from './types.js';
export interface AgentOptions {
    maxTokens?: number;
    provider?: Provider;
}
export interface AgentCallbacks {
    onText?: (text: string) => void;
    onTool?: (toolDescription: string) => void;
    onToolDone?: () => void;
}
/**
 * Run Claude agent with a prompt (console output version)
 */
export declare function runAgent(prompt: string, options?: AgentOptions): Promise<string>;
/**
 * Run Claude agent with callbacks for UI integration
 */
export declare function runAgentWithCallback(prompt: string, callbacks: AgentCallbacks, options?: AgentOptions): Promise<string>;
