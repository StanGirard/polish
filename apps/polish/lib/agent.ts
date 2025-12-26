import {
  query,
  type HookCallback,
  type PreToolUseHookInput,
  type PostToolUseHookInput
} from '@anthropic-ai/claude-agent-sdk'
import type {
  AgentEventData,
  FailedAttempt,
  MetricResult,
  PolishEvent,
  Strategy,
  ResolvedQueryOptions
} from './types'
import { createToolLogger } from './tool-logger'

// ============================================================================
// Single Fix Agent
// ============================================================================

export interface SingleFixContext {
  projectPath: string
  strategy: Strategy
  targetMetric: MetricResult
  failedAttempts: FailedAttempt[]
  rules: string[]
}

export interface SingleFixResult {
  success: boolean
  message?: string
}

function buildSingleFixPrompt(context: SingleFixContext): string {
  const { strategy, targetMetric, failedAttempts, rules } = context

  let prompt = `You must fix ONE SINGLE problem in this codebase.

## Metric to Improve
- **${targetMetric.name}**: ${targetMetric.rawValue} (score: ${targetMetric.normalizedScore.toFixed(1)}/100)
- Target: ${targetMetric.target}
- ${targetMetric.higherIsBetter ? 'Higher = better' : 'Lower = better'}

## Your Task
${strategy.prompt}

## Strict Rules
${rules.map(r => `- ${r}`).join('\n')}
- ONE SINGLE atomic change
- Verify tests pass after the modification`

  if (failedAttempts.length > 0) {
    prompt += `\n\n## Failed Attempts (do not repeat)
${failedAttempts.map(f => `- ${f.strategy}${f.file ? ` on ${f.file}` : ''}${f.line ? `:${f.line}` : ''} → ${f.reason}`).join('\n')}`
  }

  prompt += `\n\nStart by analyzing the problem, then apply the fix.`

  return prompt
}

function buildSystemPrompt(rules: string[]): string {
  return `You are an expert code quality improvement agent.

## Your Approach
1. **Analyze** - Use diagnostic commands (lint, tsc, tests)
2. **Identify** - Find the specific problem to fix
3. **Fix** - Apply ONE SINGLE minimal fix
4. **Verify** - Confirm the fix works

## Rules
${rules.map(r => `- ${r}`).join('\n')}

## Available Tools
- Glob: find files by pattern
- Grep: search text in files
- Read: read a file
- Edit: modify a file (preferred)
- Bash: run commands (lint, tsc, npm test)

## Important
- Prefer Edit over Write for modifying existing files
- Don't modify config files without reason
- One single atomic change per session`
}

export async function* runSingleFix(
  context: SingleFixContext,
  queryOptions?: ResolvedQueryOptions
): AsyncGenerator<PolishEvent> {
  const { projectPath, rules } = context

  // Queue pour les events des hooks
  const hookEvents: PolishEvent[] = []

  // Initialize tool logger
  const logLevel = process.env.TOOL_LOG_LEVEL as 'minimal' | 'normal' | 'verbose' | 'debug' || 'normal'
  const { tracker: toolTracker, hook: toolLoggerHook } = createToolLogger(logLevel)

  const toolHook: HookCallback = async (input) => {
    if (input.hook_event_name !== 'PreToolUse' && input.hook_event_name !== 'PostToolUse') {
      return {}
    }

    // Log tool call with enhanced logger
    await toolLoggerHook(input)

    const toolInput = input as PreToolUseHookInput | PostToolUseHookInput
    const eventData: AgentEventData = {
      tool: toolInput.tool_name,
      input: toolInput.tool_input,
      phase: toolInput.hook_event_name
    }

    if (toolInput.hook_event_name === 'PostToolUse') {
      eventData.output = (toolInput as PostToolUseHookInput).tool_response
    }

    hookEvents.push({ type: 'agent', data: eventData })
    return {}
  }

  try {
    // Use custom system prompt if provided, otherwise build default
    const systemPrompt = queryOptions?.systemPrompt || buildSystemPrompt(rules)

    // Auto-continuation support (same as implement.ts)
    const MAX_CONTINUATIONS = 5
    let sessionId: string | undefined
    let continuationCount = 0
    let shouldContinue = true

    while (shouldContinue && continuationCount <= MAX_CONTINUATIONS) {
      const isResume = sessionId !== undefined
      const prompt = isResume
        ? 'Continue le fix en cours.'
        : buildSingleFixPrompt(context)

      // Merge default options with resolved capabilities
      const defaultAllowedTools = ['Read', 'Edit', 'Bash', 'Glob', 'Grep']

      for await (const message of query({
        prompt,
        options: {
          cwd: projectPath,
          systemPrompt,
          // Use resolved tools or default
          tools: queryOptions?.tools,
          allowedTools: queryOptions?.allowedTools || defaultAllowedTools,
          disallowedTools: queryOptions?.disallowedTools,
          // MCP servers and plugins from capabilities
          mcpServers: queryOptions?.mcpServers,
          plugins: queryOptions?.plugins,
          agents: queryOptions?.agents,
          settingSources: queryOptions?.settingSources,
          permissionMode: 'acceptEdits',
          maxTurns: 30,
          maxThinkingTokens: 16000,
          resume: sessionId,
          hooks: {
            PreToolUse: [{ hooks: [toolHook] }],
            PostToolUse: [{ hooks: [toolHook] }]
          }
        }
      })) {
        // Yield hook events
        while (hookEvents.length > 0) {
          yield hookEvents.shift()!
        }

        // Process SDK messages
        if (message.type === 'assistant' && message.message?.content) {
          for (const block of message.message.content) {
            if ('text' in block) {
              yield {
                type: 'agent',
                data: { message: block.text }
              }
            }
          }
        } else if (message.type === 'result') {
          if (message.subtype === 'error_max_turns') {
            // Hit max turns - capture session and continue
            sessionId = message.session_id
            continuationCount++

            yield {
              type: 'agent',
              data: {
                message: `Continuing fix (${continuationCount}/${MAX_CONTINUATIONS})...`
              }
            }
            break // Break inner loop, continue outer while loop
          } else {
            // Success or other completion - exit
            yield {
              type: 'agent',
              data: {
                message: message.subtype === 'success'
                  ? 'Fix applied successfully'
                  : `Agent stopped: ${message.subtype}`
              }
            }
            shouldContinue = false
          }
        }
      }
    }

    if (continuationCount > MAX_CONTINUATIONS) {
      yield {
        type: 'agent',
        data: {
          message: 'Fix reached maximum continuations limit'
        }
      }
    }

    // Log tool call statistics at the end
    if (logLevel === 'verbose' || logLevel === 'debug') {
      const summary = toolTracker.getSummary()
      console.log(summary)
    }
  } catch (error) {
    yield {
      type: 'error',
      data: {
        message: error instanceof Error ? error.message : String(error)
      }
    }
  }
}

// ============================================================================
// Legacy: Full Polish Agent (for backward compatibility)
// ============================================================================

const LEGACY_SYSTEM_PROMPT = `You are an expert code quality improvement agent. Your mission:

1. **Analyze** the codebase:
   - Run \`npm run lint\` or \`npx eslint . --format json\` for lint errors
   - Run \`npx tsc --noEmit\` for TypeScript errors
   - Run \`npm test\` to check tests

2. **Prioritize** problems by impact:
   - Critical errors (prevent compilation)
   - Type errors
   - Lint errors
   - Warnings

3. **Fix** ONE problem at a time:
   - Read the affected file with Read
   - Apply the minimal fix with Edit
   - Verify the fix works (recompile, relint)

4. **Iterate** until the code is clean

## Strict Rules
- ONE SINGLE atomic change per iteration
- Always verify tests pass after each modification
- Never touch config files (package.json, tsconfig.json) without valid reason
- Prefer removing dead code rather than adding code
- Use Glob and Grep to explore the codebase before acting`

export async function* runPolishAgent(
  repoPath: string,
  maxTurns: number = 20
): AsyncGenerator<PolishEvent> {
  const hookEvents: PolishEvent[] = []

  // Initialize tool logger
  const logLevel = process.env.TOOL_LOG_LEVEL as 'minimal' | 'normal' | 'verbose' | 'debug' || 'normal'
  const { tracker: toolTracker, hook: toolLoggerHook } = createToolLogger(logLevel)

  const toolHook: HookCallback = async (input) => {
    if (input.hook_event_name !== 'PreToolUse' && input.hook_event_name !== 'PostToolUse') {
      return {}
    }

    // Log tool call with enhanced logger
    await toolLoggerHook(input)

    const toolInput = input as PreToolUseHookInput | PostToolUseHookInput
    const event: PolishEvent = {
      type: 'agent',
      data: {
        tool: toolInput.tool_name,
        input: toolInput.tool_input,
        phase: toolInput.hook_event_name
      }
    }

    if (toolInput.hook_event_name === 'PostToolUse') {
      event.data.output = (toolInput as PostToolUseHookInput).tool_response
    }

    hookEvents.push(event)
    return {}
  }

  try {
    yield {
      type: 'status',
      data: { phase: 'init', message: 'Starting polish agent...' }
    }

    for await (const message of query({
      prompt: `Analyze and improve code quality in this directory.

Steps:
1. First, explore the project with Glob to understand its structure
2. Run quality tools (lint, typecheck, tests)
3. Identify problems to fix
4. Fix them one by one, verifying after each fix

Start now.`,
      options: {
        cwd: repoPath,
        systemPrompt: LEGACY_SYSTEM_PROMPT,
        allowedTools: ['Read', 'Edit', 'Bash', 'Glob', 'Grep'],
        permissionMode: 'acceptEdits',
        maxTurns,
        maxThinkingTokens: 16000,
        hooks: {
          PreToolUse: [{ hooks: [toolHook] }],
          PostToolUse: [{ hooks: [toolHook] }]
        }
      }
    })) {
      while (hookEvents.length > 0) {
        yield hookEvents.shift()!
      }

      if (message.type === 'system' && message.subtype === 'init') {
        yield {
          type: 'status',
          data: {
            phase: 'running',
            message: 'Agent initialized',
            sessionId: message.session_id,
            tools: message.tools,
            model: message.model
          }
        }
      } else if (message.type === 'assistant' && message.message?.content) {
        for (const block of message.message.content) {
          if ('text' in block) {
            yield {
              type: 'agent',
              data: { message: block.text }
            }
          }
        }
      } else if (message.type === 'result') {
        yield {
          type: 'result',
          data: {
            success: message.subtype === 'success',
            initialScore: 0,
            finalScore: 0,
            commits: [],
            iterations: message.num_turns,
            cost: message.total_cost_usd,
            duration: message.duration_ms
          }
        }
      }
    }

    // Log tool call statistics at the end
    if (logLevel === 'verbose' || logLevel === 'debug') {
      const summary = toolTracker.getSummary()
      console.log(summary)
    }
  } catch (error) {
    yield {
      type: 'error',
      data: {
        message: error instanceof Error ? error.message : String(error)
      }
    }
  }
}
