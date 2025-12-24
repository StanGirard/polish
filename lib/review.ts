/**
 * Review Gate Phase (Phase 3)
 *
 * Quality gate with a single comprehensive review agent that checks:
 * - Mission alignment: Does the implementation match the original request?
 * - Code quality: Architecture, maintainability, bugs, best practices
 * - Production readiness: Is the code ready to ship?
 *
 * The agent must approve for the feature to be validated.
 * Otherwise, code is sent back to Phase 1 (implement) or Phase 2 (testing).
 */

import {
  query,
  type HookCallback,
  type PreToolUseHookInput,
  type PostToolUseHookInput
} from '@anthropic-ai/claude-agent-sdk'
import type {
  PolishEvent,
  ReviewResult,
  ReviewGateConfig,
  ReviewPhaseResult,
  ReviewRedirectTarget,
  ReviewAgentType,
  ResolvedQueryOptions
} from './types'
import { createToolLogger } from './tool-logger'

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_MAX_ITERATIONS = 3
const REVIEW_AGENT: ReviewAgentType = 'code_reviewer' // Single unified reviewer

// ============================================================================
// Review Context
// ============================================================================

export interface ReviewContext {
  projectPath: string
  mission: string
  changedFiles: string[]
  iteration: number
  previousFeedback?: string[]
}

// ============================================================================
// Prompt Builder
// ============================================================================

function buildReviewPrompt(context: ReviewContext): string {
  const { mission, changedFiles, iteration, previousFeedback } = context

  let prompt = `## Code Review Request (Iteration ${iteration})

### Original Mission
${mission}

### Modified Files
${changedFiles.length > 0 ? changedFiles.map(f => `- \`${f}\``).join('\n') : '- No modified files detected'}

Review the implementation and determine if it's ready for production.
`

  if (previousFeedback && previousFeedback.length > 0) {
    prompt += `
### Previous Iteration Feedback
${previousFeedback.map((f, i) => `**Iteration ${i + 1}:**\n${f}`).join('\n\n')}

**CRITICAL:** Verify that previous issues have been addressed.
`
  }

  prompt += `
### Review Instructions
1. **Explore** - Use Glob/Grep/Read to examine the modified files
2. **Analyze** - Check mission alignment, code quality, and production readiness
3. **Verdict** - Return your assessment in JSON format

Be thorough but pragmatic. Focus on what matters.`

  return prompt
}

// ============================================================================
// Default System Prompt
// ============================================================================

const DEFAULT_SYSTEM_PROMPT = `You are a thorough CODE REVIEWER. Your job is to evaluate if an implementation is ready for production.

## What You Check

### Mission Alignment
- Does the implementation do what was asked?
- Is there scope creep or missing features?

### Code Quality
- Are there bugs or potential issues?
- Is the code maintainable and well-structured?
- Are there security concerns?

### Production Readiness
- Does it follow project patterns?
- Are errors handled properly?
- Is it tested adequately?

## Your Approach
- Be thorough but pragmatic
- Focus on issues that actually matter
- Give specific, actionable feedback with file:line references
- Don't nitpick style if it's consistent with the project

## Required Response Format
Return a JSON block:
\`\`\`json
{
  "verdict": "approved" | "needs_changes" | "rejected",
  "redirectTo": "implement" | "testing",
  "feedback": "Clear summary of your assessment",
  "concerns": ["file.ts:42 - specific issue"],
  "score": 0-100
}
\`\`\`

- **approved**: Ready for production
- **needs_changes**: Fixable issues, redirect to implement or testing
- **rejected**: Critical problems requiring major rework`

// ============================================================================
// Response Parser
// ============================================================================

function parseReviewResult(response: string): ReviewResult {
  const jsonMatch = response.match(/```json\s*([\s\S]*?)\s*```/)

  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[1])
      return {
        agent: REVIEW_AGENT,
        verdict: parsed.verdict || 'needs_changes',
        feedback: parsed.feedback || 'No feedback provided',
        concerns: parsed.concerns || [],
        redirectTo: parsed.redirectTo,
        score: parsed.score
      }
    } catch {
      // JSON parse failed
    }
  }

  // Fallback: infer from text
  const isApproved = /\bapproved\b|lgtm|looks good/i.test(response)
  const isRejected = /\brejected\b|critical|fail/i.test(response)

  return {
    agent: REVIEW_AGENT,
    verdict: isApproved ? 'approved' : isRejected ? 'rejected' : 'needs_changes',
    feedback: response.substring(0, 1000),
    concerns: [],
    redirectTo: 'implement'
  }
}

// ============================================================================
// Review Agent Runner
// ============================================================================

async function* runReviewAgent(
  context: ReviewContext,
  queryOptions?: ResolvedQueryOptions
): AsyncGenerator<PolishEvent, ReviewResult> {
  const hookEvents: PolishEvent[] = []
  let fullResponse = ''

  const logLevel = process.env.TOOL_LOG_LEVEL as 'minimal' | 'normal' | 'verbose' | 'debug' || 'normal'
  const { hook: toolLoggerHook } = createToolLogger(logLevel)

  const toolHook: HookCallback = async (input) => {
    if (input.hook_event_name !== 'PreToolUse' && input.hook_event_name !== 'PostToolUse') {
      return {}
    }
    await toolLoggerHook(input)

    const toolInput = input as PreToolUseHookInput | PostToolUseHookInput
    hookEvents.push({
      type: 'agent',
      data: {
        tool: toolInput.tool_name,
        input: toolInput.tool_input,
        phase: toolInput.hook_event_name,
        output: toolInput.hook_event_name === 'PostToolUse'
          ? (toolInput as PostToolUseHookInput).tool_response
          : undefined
      }
    })
    return {}
  }

  const prompt = buildReviewPrompt(context)
  const agentDef = queryOptions?.agents?.[REVIEW_AGENT]
  const systemPrompt = agentDef?.prompt || DEFAULT_SYSTEM_PROMPT
  const tools = agentDef?.tools || ['Read', 'Glob', 'Grep']

  try {
    for await (const message of query({
      prompt,
      options: {
        cwd: context.projectPath,
        systemPrompt,
        tools,
        allowedTools: tools,
        disallowedTools: ['Write', 'Edit'],
        permissionMode: 'default',
        maxTurns: 30,
        maxThinkingTokens: 32000,
        env: {
          ...process.env,
          ANTHROPIC_BASE_URL: process.env.ANTHROPIC_BASE_URL || 'https://openrouter.ai/api',
          ANTHROPIC_AUTH_TOKEN: process.env.ANTHROPIC_AUTH_TOKEN || process.env.OPENROUTER_API_KEY,
          ANTHROPIC_API_KEY: ''
        },
        hooks: {
          PreToolUse: [{ hooks: [toolHook] }],
          PostToolUse: [{ hooks: [toolHook] }]
        }
      }
    })) {
      // Yield hook events (tool calls)
      while (hookEvents.length > 0) {
        yield hookEvents.shift()!
      }

      // Handle streaming content
      if (message.type === 'assistant' && message.message?.content) {
        for (const block of message.message.content) {
          // Stream thinking blocks
          if ('thinking' in block && block.thinking) {
            yield {
              type: 'review_thinking',
              data: { chunk: block.thinking }
            }
          }
          // Stream text blocks
          if ('text' in block && block.text) {
            fullResponse += block.text
            yield {
              type: 'review_stream',
              data: { chunk: block.text }
            }
          }
        }
      }
    }
  } catch (error) {
    return {
      agent: REVIEW_AGENT,
      verdict: 'rejected',
      feedback: `Review failed: ${error instanceof Error ? error.message : String(error)}`,
      concerns: ['Agent execution failed'],
      redirectTo: 'implement'
    }
  }

  return parseReviewResult(fullResponse)
}

// ============================================================================
// Main Review Gate
// ============================================================================

export async function* runReviewGate(
  context: ReviewContext,
  config: ReviewGateConfig = {},
  queryOptions?: ResolvedQueryOptions
): AsyncGenerator<PolishEvent, ReviewPhaseResult> {
  const { maxIterations = DEFAULT_MAX_ITERATIONS } = config
  const currentIteration = context.iteration

  // Emit phase start
  yield {
    type: 'phase',
    data: { phase: 'review', mission: context.mission, iteration: currentIteration }
  }

  yield {
    type: 'status',
    data: {
      phase: 'review',
      message: `Starting Review (iteration ${currentIteration}/${maxIterations})...`
    }
  }

  yield {
    type: 'review_start',
    data: {
      iteration: currentIteration,
      maxIterations,
      agent: REVIEW_AGENT
    }
  }

  // Run the review agent
  let result: ReviewResult | null = null
  const generator = runReviewAgent(context, queryOptions)

  let iterResult: IteratorResult<PolishEvent, ReviewResult>
  do {
    iterResult = await generator.next()
    if (!iterResult.done && iterResult.value) {
      yield iterResult.value
    }
  } while (!iterResult.done)
  result = iterResult.value

  // Emit result
  yield {
    type: 'review_result',
    data: {
      agent: result.agent,
      verdict: result.verdict,
      feedback: result.feedback,
      concerns: result.concerns,
      score: result.score,
      iteration: currentIteration
    }
  }

  yield {
    type: 'status',
    data: {
      phase: 'review',
      message: `Review: ${result.verdict.toUpperCase()}`,
      verdict: result.verdict,
      score: result.score
    }
  }

  // Handle verdict
  if (result.verdict === 'approved') {
    yield {
      type: 'review_complete',
      data: {
        approved: true,
        iterations: currentIteration,
        stoppedReason: 'approved'
      }
    }

    yield {
      type: 'status',
      data: {
        phase: 'review',
        message: 'APPROVED! Feature is ready for production.'
      }
    }

    return {
      approved: true,
      iterations: currentIteration,
      reviews: [result]
    }
  }

  // Not approved
  const redirectTarget: ReviewRedirectTarget = result.redirectTo || 'implement'

  yield {
    type: 'review_redirect',
    data: {
      reason: result.verdict === 'rejected' ? 'Critical issues found' : 'Changes required',
      redirectTo: redirectTarget,
      feedback: result.feedback,
      iteration: currentIteration,
      totalIterations: maxIterations
    }
  }

  yield {
    type: 'review_complete',
    data: {
      approved: false,
      iterations: currentIteration,
      stoppedReason: result.verdict === 'rejected' ? 'rejected' :
        currentIteration >= maxIterations ? 'max_iterations' : undefined
    }
  }

  yield {
    type: 'status',
    data: {
      phase: 'review',
      message: `${result.verdict === 'rejected' ? 'REJECTED' : 'Changes needed'}. Redirecting to ${redirectTarget} phase.`
    }
  }

  return {
    approved: false,
    iterations: currentIteration,
    reviews: [result],
    finalFeedback: result.feedback,
    redirectTo: redirectTarget
  }
}
