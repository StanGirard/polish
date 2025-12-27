import Anthropic from '@anthropic-ai/sdk';
import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'fs';
import { exec as execCallback } from 'child_process';
import { promisify } from 'util';
import { join } from 'path';
import { glob } from 'glob';
import chalk from 'chalk';
import { getApiKey, getBaseUrl, getModel } from './settings.js';
const exec = promisify(execCallback);
// Tool definitions for Anthropic format
const anthropicTools = [
    {
        name: 'read_file',
        description: 'Read the contents of a file at the given path.',
        input_schema: {
            type: 'object',
            properties: {
                path: { type: 'string', description: 'The path to the file to read' },
            },
            required: ['path'],
        },
    },
    {
        name: 'write_file',
        description: 'Write content to a file at the given path. Creates the file if it does not exist.',
        input_schema: {
            type: 'object',
            properties: {
                path: { type: 'string', description: 'The path to the file to write' },
                content: { type: 'string', description: 'The content to write to the file' },
            },
            required: ['path', 'content'],
        },
    },
    {
        name: 'edit_file',
        description: 'Edit a file by replacing an old string with a new string. The old_string must match exactly.',
        input_schema: {
            type: 'object',
            properties: {
                path: { type: 'string', description: 'The path to the file to edit' },
                old_string: { type: 'string', description: 'The exact string to replace' },
                new_string: { type: 'string', description: 'The string to replace it with' },
            },
            required: ['path', 'old_string', 'new_string'],
        },
    },
    {
        name: 'bash',
        description: 'Execute a bash command and return the output.',
        input_schema: {
            type: 'object',
            properties: {
                command: { type: 'string', description: 'The bash command to execute' },
            },
            required: ['command'],
        },
    },
    {
        name: 'glob',
        description: 'Find files matching a glob pattern.',
        input_schema: {
            type: 'object',
            properties: {
                pattern: { type: 'string', description: 'The glob pattern (e.g., "**/*.ts")' },
            },
            required: ['pattern'],
        },
    },
    {
        name: 'grep',
        description: 'Search for a pattern in files. Returns matching lines with file paths.',
        input_schema: {
            type: 'object',
            properties: {
                pattern: { type: 'string', description: 'The regex pattern to search for' },
                path: { type: 'string', description: 'The directory or file to search in (default: current directory)' },
            },
            required: ['pattern'],
        },
    },
    {
        name: 'list_dir',
        description: 'List the contents of a directory.',
        input_schema: {
            type: 'object',
            properties: {
                path: { type: 'string', description: 'The path to the directory to list (default: current directory)' },
            },
            required: [],
        },
    },
];
const openaiTools = anthropicTools.map((tool) => ({
    type: 'function',
    function: {
        name: tool.name,
        description: tool.description ?? '',
        parameters: tool.input_schema,
    },
}));
// Tool implementations
async function executeTool(name, input) {
    const cwd = process.cwd();
    try {
        switch (name) {
            case 'read_file': {
                const path = input.path;
                const fullPath = join(cwd, path);
                if (!existsSync(fullPath)) {
                    return { success: false, error: `File not found: ${path}` };
                }
                const content = readFileSync(fullPath, 'utf-8');
                return { success: true, output: content };
            }
            case 'write_file': {
                const path = input.path;
                const content = input.content;
                const fullPath = join(cwd, path);
                writeFileSync(fullPath, content, 'utf-8');
                return { success: true, output: `File written: ${path}` };
            }
            case 'edit_file': {
                const path = input.path;
                const oldString = input.old_string;
                const newString = input.new_string;
                const fullPath = join(cwd, path);
                if (!existsSync(fullPath)) {
                    return { success: false, error: `File not found: ${path}` };
                }
                const content = readFileSync(fullPath, 'utf-8');
                if (!content.includes(oldString)) {
                    return { success: false, error: `String not found in file: "${oldString.slice(0, 50)}..."` };
                }
                const newContent = content.replace(oldString, newString);
                writeFileSync(fullPath, newContent, 'utf-8');
                return { success: true, output: `File edited: ${path}` };
            }
            case 'bash': {
                const command = input.command;
                try {
                    const { stdout, stderr } = await exec(command, {
                        cwd,
                        timeout: 60000,
                        maxBuffer: 5 * 1024 * 1024,
                    });
                    return { success: true, output: stdout + (stderr ? `\nSTDERR:\n${stderr}` : '') };
                }
                catch (error) {
                    const execError = error;
                    return {
                        success: false,
                        output: execError.stdout,
                        error: execError.stderr || execError.message,
                    };
                }
            }
            case 'glob': {
                const pattern = input.pattern;
                const files = await glob(pattern, { cwd, ignore: ['node_modules/**', '.git/**'] });
                return { success: true, output: files.join('\n') || 'No files found' };
            }
            case 'grep': {
                const pattern = input.pattern;
                const searchPath = input.path || '.';
                try {
                    const { stdout } = await exec(`grep -rn --include="*.ts" --include="*.tsx" --include="*.js" --include="*.json" "${pattern}" ${searchPath}`, { cwd, maxBuffer: 5 * 1024 * 1024 });
                    return { success: true, output: stdout || 'No matches found' };
                }
                catch {
                    return { success: true, output: 'No matches found' };
                }
            }
            case 'list_dir': {
                const path = input.path || '.';
                const fullPath = join(cwd, path);
                if (!existsSync(fullPath)) {
                    return { success: false, error: `Directory not found: ${path}` };
                }
                const entries = readdirSync(fullPath);
                const result = entries.map((entry) => {
                    const entryPath = join(fullPath, entry);
                    const stat = statSync(entryPath);
                    return stat.isDirectory() ? `${entry}/` : entry;
                });
                return { success: true, output: result.join('\n') };
            }
            default:
                return { success: false, error: `Unknown tool: ${name}` };
        }
    }
    catch (error) {
        const err = error;
        return { success: false, error: err.message };
    }
}
// Format tool result for display
function formatToolCall(name, input) {
    switch (name) {
        case 'read_file':
            return `${chalk.blue('read')} ${input.path}`;
        case 'write_file':
            return `${chalk.green('write')} ${input.path}`;
        case 'edit_file':
            return `${chalk.yellow('edit')} ${input.path}`;
        case 'bash':
            return `${chalk.magenta('$')} ${input.command.slice(0, 60)}${input.command.length > 60 ? '...' : ''}`;
        case 'glob':
            return `${chalk.cyan('glob')} ${input.pattern}`;
        case 'grep':
            return `${chalk.cyan('grep')} ${input.pattern}`;
        case 'list_dir':
            return `${chalk.cyan('ls')} ${input.path || '.'}`;
        default:
            return `${name} ${JSON.stringify(input).slice(0, 50)}`;
    }
}
const systemPrompt = `You are a helpful coding assistant. You have access to tools to read, write, and edit files, run bash commands, and search the codebase.

When making changes:
1. First understand the existing code by reading relevant files
2. Make targeted, minimal changes
3. Ensure your changes don't break existing functionality
4. Test your changes if possible

Be concise in your responses. Focus on making the requested changes efficiently.`;
/**
 * Run Claude agent with a prompt (console output version)
 */
export async function runAgent(prompt, options = {}) {
    return runAgentWithCallback(prompt, {
        onText: (text) => console.log(chalk.dim(text)),
        onTool: (tool) => console.log(tool),
        onToolDone: () => { },
    }, options);
}
/**
 * Run Claude agent with callbacks for UI integration
 * Supports both legacy AgentCallbacks and new RichAgentCallbacks
 */
export async function runAgentWithCallback(prompt, callbacks, options = {}) {
    const provider = options.provider ?? { type: 'anthropic', model: 'claude-sonnet-4.5' };
    if (provider.type === 'openrouter') {
        return runOpenRouterAgent(prompt, callbacks, options);
    }
    if (provider.type === 'openai') {
        return runOpenAIAgent(prompt, callbacks, options);
    }
    return runAnthropicAgent(prompt, callbacks, options);
}
/**
 * Run agent using Anthropic API
 */
async function runAnthropicAgent(prompt, callbacks, options) {
    const provider = options.provider ?? { type: 'anthropic' };
    const maxTokens = options.maxTokens ?? 4096;
    const model = provider.model ?? getModel('anthropic') ?? 'claude-sonnet-4.5';
    // Support both legacy and rich callbacks
    const richCallbacks = callbacks;
    const legacyCallbacks = callbacks;
    const isRich = 'onToolStart' in callbacks;
    const apiKey = provider.apiKey ?? getApiKey('anthropic');
    if (!apiKey) {
        throw new Error('Anthropic API key not found. Set it in .polish/settings.json or ANTHROPIC_API_KEY env var');
    }
    const baseURL = provider.baseUrl ?? getBaseUrl('anthropic');
    const client = new Anthropic({ apiKey, baseURL });
    const messages = [
        { role: 'user', content: prompt },
    ];
    let finalResponse = '';
    while (true) {
        const response = await client.messages.create({
            model,
            max_tokens: maxTokens,
            system: systemPrompt,
            tools: anthropicTools,
            messages,
        });
        let hasToolUse = false;
        const toolResults = [];
        for (const block of response.content) {
            if (block.type === 'text') {
                if (block.text.trim()) {
                    richCallbacks.onText?.(block.text);
                    finalResponse += block.text;
                }
            }
            else if (block.type === 'tool_use') {
                hasToolUse = true;
                const toolInput = block.input;
                const toolDesc = formatToolCall(block.name, toolInput);
                if (isRich) {
                    richCallbacks.onToolStart?.(block.id, block.name, toolDesc);
                }
                else {
                    legacyCallbacks.onTool?.(toolDesc);
                }
                const startTime = Date.now();
                const result = await executeTool(block.name, toolInput);
                const duration = Date.now() - startTime;
                if (isRich) {
                    richCallbacks.onToolDone?.(block.id, result.success, result.output, result.error, duration);
                }
                else {
                    legacyCallbacks.onToolDone?.();
                }
                toolResults.push({
                    type: 'tool_result',
                    tool_use_id: block.id,
                    content: result.success ? result.output || 'Success' : `Error: ${result.error}`,
                    is_error: !result.success,
                });
            }
        }
        if (hasToolUse) {
            messages.push({ role: 'assistant', content: response.content });
            messages.push({ role: 'user', content: toolResults });
        }
        if (response.stop_reason === 'end_turn' && !hasToolUse) {
            break;
        }
        if (messages.length > 100) {
            richCallbacks.onText?.('Max iterations reached');
            break;
        }
    }
    return finalResponse;
}
/**
 * Shared implementation for OpenAI-compatible APIs (OpenAI, OpenRouter)
 */
async function runOpenAICompatibleAgent(prompt, callbacks, config) {
    const { apiKey, baseUrl, model, maxTokens, providerName, extraHeaders } = config;
    // Support both legacy and rich callbacks
    const richCallbacks = callbacks;
    const legacyCallbacks = callbacks;
    const isRich = 'onToolStart' in callbacks;
    const messages = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt },
    ];
    let finalResponse = '';
    while (true) {
        const response = await fetch(baseUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
                ...extraHeaders,
            },
            body: JSON.stringify({
                model,
                max_tokens: maxTokens,
                messages,
                tools: openaiTools,
            }),
        });
        if (!response.ok) {
            const error = await response.text();
            throw new Error(`${providerName} API error: ${response.status} - ${error}`);
        }
        const data = await response.json();
        const choice = data.choices[0];
        const message = choice.message;
        if (message.content) {
            richCallbacks.onText?.(message.content);
            finalResponse += message.content;
        }
        if (message.tool_calls && message.tool_calls.length > 0) {
            messages.push({
                role: 'assistant',
                content: message.content,
                tool_calls: message.tool_calls,
            });
            for (const toolCall of message.tool_calls) {
                const toolName = toolCall.function.name;
                const toolInput = JSON.parse(toolCall.function.arguments);
                const toolDesc = formatToolCall(toolName, toolInput);
                if (isRich) {
                    richCallbacks.onToolStart?.(toolCall.id, toolName, toolDesc);
                }
                else {
                    legacyCallbacks.onTool?.(toolDesc);
                }
                const startTime = Date.now();
                const result = await executeTool(toolName, toolInput);
                const duration = Date.now() - startTime;
                if (isRich) {
                    richCallbacks.onToolDone?.(toolCall.id, result.success, result.output, result.error, duration);
                }
                else {
                    legacyCallbacks.onToolDone?.();
                }
                messages.push({
                    role: 'tool',
                    content: result.success ? result.output || 'Success' : `Error: ${result.error}`,
                    tool_call_id: toolCall.id,
                });
            }
        }
        else if (choice.finish_reason === 'stop') {
            break;
        }
        if (messages.length > 100) {
            richCallbacks.onText?.('Max iterations reached');
            break;
        }
    }
    return finalResponse;
}
/**
 * Run agent using OpenAI API
 */
async function runOpenAIAgent(prompt, callbacks, options) {
    const provider = options.provider ?? { type: 'openai' };
    const apiKey = provider.apiKey ?? getApiKey('openai');
    if (!apiKey) {
        throw new Error('OpenAI API key not found. Set it in .polish/settings.json or OPENAI_API_KEY env var');
    }
    return runOpenAICompatibleAgent(prompt, callbacks, {
        apiKey,
        baseUrl: provider.baseUrl ?? getBaseUrl('openai') ?? 'https://api.openai.com/v1/chat/completions',
        model: provider.model ?? getModel('openai') ?? 'gpt-4o',
        maxTokens: options.maxTokens ?? 4096,
        providerName: 'OpenAI',
    });
}
/**
 * Run agent using OpenRouter API (OpenAI-compatible)
 */
async function runOpenRouterAgent(prompt, callbacks, options) {
    const provider = options.provider ?? { type: 'openrouter' };
    const apiKey = provider.apiKey ?? getApiKey('openrouter');
    if (!apiKey) {
        throw new Error('OpenRouter API key not found. Set it in .polish/settings.json or OPENROUTER_API_KEY env var');
    }
    return runOpenAICompatibleAgent(prompt, callbacks, {
        apiKey,
        baseUrl: provider.baseUrl ?? getBaseUrl('openrouter') ?? 'https://openrouter.ai/api/v1/chat/completions',
        model: provider.model ?? getModel('openrouter') ?? 'anthropic/claude-sonnet-4',
        maxTokens: options.maxTokens ?? 4096,
        providerName: 'OpenRouter',
        extraHeaders: {
            'HTTP-Referer': 'https://github.com/polish-cli',
            'X-Title': 'Polish CLI',
        },
    });
}
