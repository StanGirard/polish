/**
 * Review Gate Phase (Phase 3)
 *
 * Strict quality gate with 3 specialized review agents:
 * - mission_reviewer: Verifies implementation matches the original mission
 * - senior_engineer: Evaluates architecture, maintainability, best practices
 * - code_reviewer: Line-by-line review for bugs, conventions, code smells
 *
 * All 3 agents must approve for the feature to be validated.
 * Otherwise, code is sent back to Phase 1 (implement) or Phase 2 (testing).
 *
 * Key features:
 * - Parallel execution: All 3 agents run concurrently for faster reviews
 * - Strict mode: All agents must approve (configurable)
 * - Iteration support: Multiple review cycles with feedback accumulation
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
  ReviewVerdict,
  ReviewRedirectTarget,
  ReviewAgentType,
  ResolvedQueryOptions
} from './types'
import { createToolLogger } from './tool-logger'

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_MAX_ITERATIONS = 3
const REVIEW_AGENTS: ReviewAgentType[] = ['mission_reviewer', 'senior_engineer', 'code_reviewer']

// ============================================================================
// Review Context
// ============================================================================

export interface ReviewContext {
  projectPath: string
  mission: string
  changedFiles: string[]
  iteration: number
  previousFeedback?: string[]  // Feedback from previous iterations
}

// ============================================================================
// Prompt Builder
// ============================================================================

function buildReviewPrompt(
  agentType: ReviewAgentType,
  context: ReviewContext
): string {
  const { mission, changedFiles, iteration, previousFeedback } = context

  const agentDescriptions: Record<ReviewAgentType, { name: string; focus: string }> = {
    mission_reviewer: {
      name: 'Mission Reviewer',
      focus: 'Verify the implementation matches the original mission requirements exactly. Detect any scope creep, missing features, or deviations.'
    },
    senior_engineer: {
      name: 'Senior Engineer',
      focus: 'Evaluate architecture decisions, code maintainability, performance implications, and adherence to best practices.'
    },
    code_reviewer: {
      name: 'Code Reviewer',
      focus: 'Perform line-by-line code review. Find bugs, code smells, convention violations, and potential issues.'
    }
  }

  const agent = agentDescriptions[agentType]

  let prompt = `## Code Review Request (Iteration ${iteration})

### Original Mission
${mission}

### Modified Files
${changedFiles.length > 0 ? changedFiles.map(f => `- \`${f}\``).join('\n') : '- No modified files detected'}

### Your Role: ${agent.name}
${agent.focus}

Review the changes and determine if the implementation is acceptable.
`

  if (previousFeedback && previousFeedback.length > 0) {
    prompt += `
### Previous Iteration Feedback
${previousFeedback.map((f, i) => `**Iteration ${i + 1}:**\n${f}`).join('\n\n')}

**CRITICAL:** Verify that previous issues have been addressed. If not, they must be flagged again.
`
  }

  prompt += `
### Review Instructions
1. **Explore** - Use Glob/Grep/Read to examine the modified files thoroughly
2. **Analyze** - Evaluate the code against your specific review criteria
3. **Verdict** - Return your assessment in the JSON format specified in your system prompt

Be STRICT and THOROUGH. Quality matters. Don't let issues slip through.`

  return prompt
}

// ============================================================================
// Response Parser
// ============================================================================

function parseReviewResult(
  response: string,
  agentType: ReviewAgentType
): ReviewResult {
  // Extract JSON from response
  const jsonMatch = response.match(/```json\s*([\s\S]*?)\s*```/)

  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[1])
      return {
        agent: agentType,
        verdict: parsed.verdict || 'needs_changes',
        feedback: parsed.feedback || 'No feedback provided',
        concerns: parsed.concerns || [],
        redirectTo: parsed.redirectTo,
        score: parsed.score
      }
    } catch {
      // JSON parse failed, continue to fallback
    }
  }

  // Fallback: try to infer from text
  const lowerResponse = response.toLowerCase()
  const isApproved = /\bapproved\b|lgtm|looks good|validé|approuvé/i.test(response)
  const isRejected = /\brejected\b|critical|fail|rejeté|échec critique/i.test(response)

  return {
    agent: agentType,
    verdict: isApproved ? 'approved' : isRejected ? 'rejected' : 'needs_changes',
    feedback: response.substring(0, 1000), // Truncate long responses
    concerns: [],
    redirectTo: 'implement' // Default redirect
  }
}

// ============================================================================
// Default System Prompts
// ============================================================================

function getDefaultSystemPrompt(agentType: ReviewAgentType): string {
  const prompts: Record<ReviewAgentType, string> = {
    mission_reviewer: `You are the MISSION GUARDIAN. You are RELENTLESS about mission alignment.

## Your Mission
Verify that the implementation matches EXACTLY what was requested. No deviations tolerated.

## What You Check
- Does the implementation do WHAT WAS ASKED?
- Are there features added that weren't requested (scope creep)?
- Are there aspects of the mission NOT implemented?
- Does the behavior match expectations?

## Common Deviations to Detect
- Over-engineering (too complex for the need)
- Bonus features not requested
- Changes outside scope
- Unnecessary refactoring
- Unsolicited "improvements"

## You Are STRICT
- If the mission isn't 100% respected, you flag it
- You tolerate NO deviation
- You cite the original mission and show discrepancies
- You are precise about what's missing or extra

## Required Response Format
Return ONLY a JSON block:
\`\`\`json
{
  "verdict": "approved" | "needs_changes" | "rejected",
  "redirectTo": "implement" | "testing",
  "feedback": "Detailed explanation of mission alignment",
  "concerns": ["Deviation 1 from mission", "Unrequested feature X"],
  "score": 0-100
}
\`\`\``,

    senior_engineer: `You are a SENIOR ENGINEER with 20+ years of experience. You are STRICT and CRITICAL.

## Your Mission
Evaluate if the implementation is production-ready. You make NO compromises on quality.

## Evaluation Criteria (STRICT)

### Architecture (25%)
- Does the code follow project patterns?
- Is it well-structured and modular?
- Are responsibilities properly separated?

### Maintainability (25%)
- Will this code be easy to maintain in 6 months?
- Are names clear and explicit?
- Is complexity justified?

### Performance (20%)
- Are there obvious performance issues?
- Are algorithms appropriate?
- Are there potential memory leaks?

### Security (15%)
- Are there security vulnerabilities?
- Are inputs validated?
- Are errors handled correctly?

### Tests (15%)
- Are tests sufficient?
- Do they cover edge cases?
- Are they maintainable?

## You Are STRICT
- If ANY criterion isn't satisfied, you flag needs_changes
- You give PRECISE and ACTIONABLE feedback
- You identify specific files and lines
- You propose concrete solutions

## Required Response Format
Return ONLY a JSON block:
\`\`\`json
{
  "verdict": "approved" | "needs_changes" | "rejected",
  "redirectTo": "implement" | "testing",
  "feedback": "Detailed explanation with code examples",
  "concerns": ["file.ts:42 - issue X", "Architecture: issue Y"],
  "score": 0-100
}
\`\`\``,

    code_reviewer: `You are a meticulous and RELENTLESS CODE REVIEWER. You examine every line.

## Your Mission
Detailed code review to identify ALL issues, even minor ones.

## What You Look For

### Potential Bugs (Critical)
- Unhandled null/undefined
- Race conditions
- Logic errors
- Off-by-one errors
- Memory leaks

### Code Smells (Important)
- Code duplication
- Functions too long (>50 lines)
- High cyclomatic complexity
- Magic numbers/strings
- Dead code

### Conventions (Moderate)
- Inconsistent naming
- Incorrect formatting
- Unused imports
- Unresolved TODO/FIXME
- Forgotten console.log

### TypeScript Types (Important)
- Missing types or 'any'
- Incorrect types
- Dangerous type assertions
- Misused generics

### Error Handling (Critical)
- Silent errors (empty catch)
- Errors not propagated
- Unclear error messages

## You Are RELENTLESS
- You find ALL issues
- You give examples of corrected code
- You cite exact lines
- You let NOTHING pass

## Required Response Format
Return ONLY a JSON block:
\`\`\`json
{
  "verdict": "approved" | "needs_changes" | "rejected",
  "redirectTo": "implement" | "testing",
  "feedback": "Summary of issues found with fix examples",
  "concerns": ["file.ts:42 - bug: missing null check", "file.ts:15 - smell: function too long"],
  "score": 0-100
}
\`\`\``
  }

  return prompts[agentType]
}

// ============================================================================
// Single Review Agent Runner
// ============================================================================

async function* runReviewAgent(
  agentType: ReviewAgentType,
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

  const prompt = buildReviewPrompt(agentType, context)

  // Get agent definition from options
  const agentDef = queryOptions?.agents?.[agentType]
  const systemPrompt = agentDef?.prompt || getDefaultSystemPrompt(agentType)
  const tools = agentDef?.tools || ['Read', 'Glob', 'Grep']

  try {
    for await (const message of query({
      prompt,
      options: {
        cwd: context.projectPath,
        systemPrompt,
        tools,
        allowedTools: tools,
        disallowedTools: ['Write', 'Edit'], // Read-only
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
      // Yield hook events
      while (hookEvents.length > 0) {
        yield hookEvents.shift()!
      }

      if (message.type === 'assistant' && message.message?.content) {
        for (const block of message.message.content) {
          if ('text' in block) {
            fullResponse += block.text
          }
        }
      }
    }
  } catch (error) {
    // Return error as rejection
    return {
      agent: agentType,
      verdict: 'rejected',
      feedback: `Error running review agent: ${error instanceof Error ? error.message : String(error)}`,
      concerns: ['Agent execution failed'],
      redirectTo: 'implement'
    }
  }

  return parseReviewResult(fullResponse, agentType)
}

// ============================================================================
// Helper: Collect events and result from agent generator
// ============================================================================

interface AgentExecutionResult {
  agentType: ReviewAgentType
  events: PolishEvent[]
  result: ReviewResult
}

/**
 * Runs a review agent and collects all events and the final result.
 * This helper properly handles the async generator to get both yielded events
 * and the return value in a single execution.
 */
async function executeReviewAgent(
  agentType: ReviewAgentType,
  context: ReviewContext,
  queryOptions?: ResolvedQueryOptions
): Promise<AgentExecutionResult> {
  const events: PolishEvent[] = []
  const generator = runReviewAgent(agentType, context, queryOptions)

  let iterResult: IteratorResult<PolishEvent, ReviewResult>
  do {
    iterResult = await generator.next()
    if (!iterResult.done && iterResult.value) {
      events.push(iterResult.value)
    }
  } while (!iterResult.done)

  return {
    agentType,
    events,
    result: iterResult.value
  }
}

// ============================================================================
// Main Review Gate (Parallel Execution)
// ============================================================================

export async function* runReviewGate(
  context: ReviewContext,
  config: ReviewGateConfig = {},
  queryOptions?: ResolvedQueryOptions
): AsyncGenerator<PolishEvent, ReviewPhaseResult> {
  const {
    maxIterations = DEFAULT_MAX_ITERATIONS,
    requireAllApproval = true
  } = config

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
      message: `Starting Review Gate (iteration ${currentIteration}/${maxIterations})...`
    }
  }

  // Emit start events for all agents (they will run in parallel)
  for (const agentType of REVIEW_AGENTS) {
    yield {
      type: 'review_start',
      data: {
        iteration: currentIteration,
        maxIterations,
        agent: agentType
      }
    }
  }

  yield {
    type: 'status',
    data: {
      phase: 'review',
      message: 'Running all 3 review agents in parallel...'
    }
  }

  // Run all 3 agents in PARALLEL
  const agentPromises = REVIEW_AGENTS.map(agentType =>
    executeReviewAgent(agentType, context, queryOptions)
  )

  const agentResults = await Promise.all(agentPromises)

  // Yield all collected events from each agent (grouped by agent for clarity)
  for (const { agentType, events, result } of agentResults) {
    // Yield the agent's events
    for (const event of events) {
      yield event
    }

    // Yield the result event
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
        message: `${agentType.replace('_', ' ')}: ${result.verdict.toUpperCase()}`,
        verdict: result.verdict,
        score: result.score
      }
    }
  }

  // Collect all reviews
  const reviews = agentResults.map(r => r.result)

  // Analyze verdicts
  const verdicts = reviews.map(r => r.verdict)
  const allApproved = verdicts.every(v => v === 'approved')
  const anyRejected = verdicts.some(v => v === 'rejected')

  // Handle approval
  if (allApproved || (!requireAllApproval && verdicts.filter(v => v === 'approved').length >= 2)) {
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
        message: 'All reviewers APPROVED! Feature is ready for production.'
      }
    }

    return {
      approved: true,
      iterations: currentIteration,
      reviews
    }
  }

  // Handle rejection
  if (anyRejected) {
    const rejectedReview = reviews.find(r => r.verdict === 'rejected')!

    yield {
      type: 'review_complete',
      data: {
        approved: false,
        iterations: currentIteration,
        stoppedReason: 'rejected'
      }
    }

    yield {
      type: 'status',
      data: {
        phase: 'review',
        message: `REJECTED by ${rejectedReview.agent.replace('_', ' ')}: ${rejectedReview.feedback.substring(0, 100)}...`
      }
    }

    return {
      approved: false,
      iterations: currentIteration,
      reviews,
      finalFeedback: rejectedReview.feedback,
      redirectTo: rejectedReview.redirectTo || 'implement'
    }
  }

  // Handle needs_changes - determine redirect target
  const needsChangesReviews = reviews.filter(r => r.verdict === 'needs_changes')

  // Determine redirect: if any says "implement", go to implement, otherwise testing
  const redirectTarget: ReviewRedirectTarget = needsChangesReviews.some(r => r.redirectTo === 'implement')
    ? 'implement'
    : 'testing'

  const combinedFeedback = needsChangesReviews
    .map(r => `[${r.agent.replace('_', ' ').toUpperCase()}]\n${r.feedback}\n\nConcerns:\n${r.concerns.map(c => `- ${c}`).join('\n')}`)
    .join('\n\n---\n\n')

  yield {
    type: 'review_redirect',
    data: {
      reason: 'Changes required by reviewers',
      redirectTo: redirectTarget,
      feedback: combinedFeedback,
      iteration: currentIteration,
      totalIterations: maxIterations
    }
  }

  yield {
    type: 'review_complete',
    data: {
      approved: false,
      iterations: currentIteration,
      stoppedReason: currentIteration >= maxIterations ? 'max_iterations' : undefined
    }
  }

  yield {
    type: 'status',
    data: {
      phase: 'review',
      message: `Changes needed. Redirecting to ${redirectTarget} phase.`
    }
  }

  return {
    approved: false,
    iterations: currentIteration,
    reviews,
    finalFeedback: combinedFeedback,
    redirectTo: redirectTarget
  }
}
