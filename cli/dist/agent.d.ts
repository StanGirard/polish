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
export interface RichAgentCallbacks {
    onText?: (text: string) => void;
    onToolStart?: (id: string, name: string, displayText: string) => void;
    onToolDone?: (id: string, success: boolean, output?: string, error?: string, duration?: number) => void;
}
/**
 * Run Claude agent with a prompt (console output version)
 */
export declare function runAgent(prompt: string, options?: AgentOptions): Promise<string>;
/**
 * Run Claude agent with callbacks for UI integration
 * Supports both legacy AgentCallbacks and new RichAgentCallbacks
 */
export declare function runAgentWithCallback(prompt: string, callbacks: AgentCallbacks | RichAgentCallbacks, options?: AgentOptions): Promise<string>;
