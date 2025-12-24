/**
 * Review Gate Phase (Phase 3)
 *
 * Gate de qualité stricte avec 3 agents de review:
 * - mission_reviewer: Vérifie que l'implémentation correspond à la mission
 * - senior_engineer: Évalue architecture, maintenabilité, best practices
 * - code_reviewer: Examine ligne par ligne, bugs, conventions
 *
 * Les 3 agents doivent approuver pour que la feature soit validée.
 * Sinon, le code est renvoyé en Phase 1 (implement) ou Phase 2 (testing).
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

  const agentNames: Record<ReviewAgentType, string> = {
    mission_reviewer: 'Mission Reviewer',
    senior_engineer: 'Senior Engineer',
    code_reviewer: 'Code Reviewer'
  }

  let prompt = `## Review Request (Iteration ${iteration})

### Mission Originale
${mission}

### Fichiers Modifiés
${changedFiles.length > 0 ? changedFiles.map(f => `- ${f}`).join('\n') : '- Aucun fichier modifié détecté'}

### Ton Rôle: ${agentNames[agentType]}
Examine les changements et détermine si l'implémentation est acceptable.
`

  if (previousFeedback && previousFeedback.length > 0) {
    prompt += `
### Feedback des Itérations Précédentes
${previousFeedback.map((f, i) => `**Iteration ${i + 1}:** ${f}`).join('\n\n')}

**IMPORTANT:** Vérifie que les problèmes précédents ont été corrigés.
`
  }

  prompt += `
### Instructions
1. Explore les fichiers modifiés avec Glob/Grep/Read
2. Analyse le code en profondeur selon tes critères
3. Retourne ton verdict au format JSON spécifié dans ton system prompt

Sois SÉVÈRE et CRITIQUE. Ne laisse rien passer.`

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
  const systemPrompt = agentDef?.prompt || `Tu es un agent de review. Évalue le code et retourne un JSON avec verdict, feedback, concerns, redirectTo, score.`
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
// Main Review Gate
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
  const allReviews: ReviewResult[] = []

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

  // Run all 3 review agents
  const reviews: ReviewResult[] = []

  for (const agentType of REVIEW_AGENTS) {
    yield {
      type: 'review_start',
      data: {
        iteration: currentIteration,
        maxIterations,
        agent: agentType
      }
    }

    yield {
      type: 'status',
      data: {
        phase: 'review',
        message: `Running ${agentType.replace('_', ' ')}...`
      }
    }

    // Run the review agent
    let result: ReviewResult | null = null
    for await (const event of runReviewAgent(agentType, context, queryOptions)) {
      yield event
    }
    // Get the final result (returned by the generator)
    const agentGenerator = runReviewAgent(agentType, context, queryOptions)
    for await (const event of agentGenerator) {
      yield event
    }
    // The result is the return value of the generator
    // We need to re-run to get the actual result
    const resultGenerator = runReviewAgent(agentType, context, queryOptions)
    let lastValue: IteratorResult<PolishEvent, ReviewResult>
    do {
      lastValue = await resultGenerator.next()
      if (!lastValue.done && lastValue.value) {
        yield lastValue.value
      }
    } while (!lastValue.done)
    result = lastValue.value

    reviews.push(result)
    allReviews.push(result)

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
        message: 'All reviewers APPROVED! Feature is ready.'
      }
    }

    return {
      approved: true,
      iterations: currentIteration,
      reviews: allReviews
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
      reviews: allReviews,
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
    reviews: allReviews,
    finalFeedback: combinedFeedback,
    redirectTo: redirectTarget
  }
}
