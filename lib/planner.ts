/**
 * Planning Phase for Polish
 *
 * Interactive planning phase where the LLM explores the codebase
 * and proposes an implementation plan that the user can iterate on.
 *
 * This module implements a Claude Code-style intelligent planning system with:
 * - Multi-phase planning using specialized sub-agents
 * - Automatic exploration → analysis → planning workflow
 * - Support for different thoroughness levels (quick, medium, thorough)
 * - Parallel agent execution for independent tasks
 */

import {
  query,
  type HookCallback,
  type PreToolUseHookInput,
  type PostToolUseHookInput
} from '@anthropic-ai/claude-agent-sdk'
import type {
  PolishEvent,
  ResolvedQueryOptions,
  PlanStep,
  PlanMessage,
  PlanEventData,
  PlanningThoroughness,
  PlanningMode
} from './types'
import { createToolLogger } from './tool-logger'

// Re-export types for convenience
export type { PlanningThoroughness, PlanningMode }

// ============================================================================
// Planning Context
// ============================================================================

export interface PlanningContext {
  mission: string
  projectPath: string
  messages: PlanMessage[]  // Conversation history
  thoroughness?: PlanningThoroughness // Level of exploration depth
  mode?: PlanningMode // How to use sub-agents
}

export interface PlanningResult {
  // New simple format (primary)
  summary: string
  approach: string[]           // 5-7 concise bullet points
  files: {
    modify: string[]
    create: string[]
  }
  // Legacy fields (for backwards compatibility)
  plan: PlanStep[]
  estimatedChanges: {
    filesCreated: string[]
    filesModified: string[]
    filesDeleted: string[]
  }
  risks: string[]
  questions?: string[]
}

// ============================================================================
// System Prompt for Planning
// ============================================================================

/**
 * Get the appropriate system prompt based on planning mode and thoroughness
 * Ultra-minimalist style inspired by Claude Code
 */
function getPlanningSystemPrompt(
  thoroughness: PlanningThoroughness = 'medium',
  mode: PlanningMode = 'agent-driven'
): string {
  const explorationGuide = {
    quick: 'Exploration rapide - identifie juste les fichiers clés.',
    medium: 'Exploration modérée - lis les fichiers importants pour comprendre les patterns.',
    thorough: 'Exploration approfondie - analyse en détail avant de proposer.'
  }

  const agentHint = mode === 'agent-driven'
    ? `\n\nTu peux utiliser l'outil Task avec des sous-agents (Explore, code-analysis) pour explorer le codebase.`
    : ''

  return `Tu es en mode PLANNING. Propose un plan CONCIS que l'utilisateur peut approuver rapidement.

## ${explorationGuide[thoroughness]}${agentHint}

## RÈGLES STRICTES
1. Maximum 5-7 bullet points (pas plus!)
2. Chaque point = UNE phrase courte (action + cible)
3. Pas de descriptions longues - juste le "quoi"
4. Liste uniquement les fichiers CLÉS à modifier
5. Mode lecture seule - ne modifie rien

## FORMAT DE RÉPONSE

Retourne un JSON dans un bloc \`\`\`json:

\`\`\`json
{
  "summary": "Ce que ce plan accomplit en 1 phrase",
  "approach": [
    "Créer le composant X dans src/components",
    "Modifier Y pour ajouter Z",
    "Ajouter les tests unitaires"
  ],
  "files": {
    "modify": ["src/existing.ts"],
    "create": ["src/new.ts"]
  }
}
\`\`\`

## EXEMPLES

❌ MAUVAIS (trop verbeux):
"Créer un nouveau composant React UserProfile dans src/components/UserProfile.tsx avec une interface TypeScript pour les props, utilisant useState pour gérer l'état local et useEffect pour charger les données depuis l'API"

✅ BON (concis):
"Créer le composant UserProfile"

❌ MAUVAIS (trop d'étapes):
20+ étapes détaillant chaque modification

✅ BON (synthétique):
5-7 étapes de haut niveau`
}

const PLANNING_SYSTEM_PROMPT = getPlanningSystemPrompt('medium', 'agent-driven')

// ============================================================================
// Prompt Builders
// ============================================================================

function buildInitialPlanningPrompt(
  mission: string,
  thoroughness: PlanningThoroughness = 'medium',
  mode: PlanningMode = 'agent-driven'
): string {
  const agentHint = mode === 'agent-driven'
    ? `\n\nUtilise l'agent Explore pour comprendre le codebase si nécessaire.`
    : ''

  return `## Mission
${mission}
${agentHint}

Explore le projet puis propose un plan CONCIS (5-7 points max) au format JSON.`
}

function buildContinuationPrompt(
  messages: PlanMessage[],
  mission: string,
  thoroughness: PlanningThoroughness = 'medium',
  mode: PlanningMode = 'agent-driven'
): string {
  let prompt = `## Mission
${mission}

## Conversation
`

  for (const msg of messages) {
    const role = msg.role === 'user' ? 'User' : 'Assistant'
    prompt += `\n**${role}:** ${msg.content}\n`
  }

  prompt += `\nPrends en compte le feedback et génère un plan révisé (5-7 points max) au format JSON.`

  return prompt
}

// ============================================================================
// Response Parser
// ============================================================================

function parsePlanFromResponse(text: string): PlanningResult | null {
  // Extract JSON block from response
  const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/)
  if (!jsonMatch) {
    return null
  }

  try {
    const parsed = JSON.parse(jsonMatch[1])

    // New simple format (preferred)
    if (parsed.approach && Array.isArray(parsed.approach)) {
      return {
        summary: parsed.summary || '',
        approach: parsed.approach,
        files: {
          modify: parsed.files?.modify || [],
          create: parsed.files?.create || []
        },
        // Legacy fields for backwards compatibility
        plan: [],
        estimatedChanges: {
          filesCreated: parsed.files?.create || [],
          filesModified: parsed.files?.modify || [],
          filesDeleted: []
        },
        risks: [],
        questions: parsed.questions
      }
    }

    // Legacy format fallback (for backwards compatibility)
    if (parsed.plan && Array.isArray(parsed.plan)) {
      return {
        summary: parsed.summary || '',
        approach: parsed.plan.map((step: { title?: string }) => step.title || ''),
        files: {
          modify: parsed.estimatedChanges?.filesModified || [],
          create: parsed.estimatedChanges?.filesCreated || []
        },
        plan: parsed.plan.map((step: Partial<PlanStep>, index: number) => ({
          id: step.id || `step-${index + 1}`,
          title: step.title || `Étape ${index + 1}`,
          description: step.description || '',
          files: step.files || [],
          order: step.order ?? index + 1
        })),
        estimatedChanges: {
          filesCreated: parsed.estimatedChanges?.filesCreated || [],
          filesModified: parsed.estimatedChanges?.filesModified || [],
          filesDeleted: parsed.estimatedChanges?.filesDeleted || []
        },
        risks: parsed.risks || [],
        questions: parsed.questions
      }
    }

    return null
  } catch {
    return null
  }
}

// ============================================================================
// Main Planning Functions
// ============================================================================

/**
 * Run the initial planning phase
 * Explores the codebase and generates a plan for user approval
 *
 * This implements a Claude Code-style intelligent planning with:
 * - Automatic use of specialized sub-agents
 * - Configurable thoroughness levels
 * - Multi-phase exploration → analysis → planning workflow
 */
export async function* runPlanningPhase(
  context: PlanningContext,
  queryOptions?: ResolvedQueryOptions
): AsyncGenerator<PolishEvent> {
  const {
    mission,
    projectPath,
    messages,
    thoroughness = 'medium',
    mode = 'agent-driven'
  } = context

  // Queue for hook events
  const hookEvents: PolishEvent[] = []
  let fullResponse = ''
  let lastPlan: PlanningResult | null = null

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

    // Track sub-agent invocations for better visibility
    const isSubAgentCall = toolInput.tool_name === 'Task'
    const subAgentType = isSubAgentCall && toolInput.tool_input
      ? (toolInput.tool_input as { subagent_type?: string }).subagent_type
      : undefined

    hookEvents.push({
      type: 'agent',
      data: {
        tool: toolInput.tool_name,
        input: toolInput.tool_input,
        phase: toolInput.hook_event_name,
        output: toolInput.hook_event_name === 'PostToolUse'
          ? (toolInput as PostToolUseHookInput).tool_response
          : undefined,
        // Add sub-agent metadata if applicable
        ...(subAgentType && { subAgentType })
      }
    })
    return {}
  }

  // Status message based on thoroughness
  const statusMessages = {
    quick: 'Quick exploration and plan generation...',
    medium: 'Exploring codebase with sub-agents and generating implementation plan...',
    thorough: 'Deep analysis with multiple sub-agents for comprehensive planning...'
  }

  yield {
    type: 'status',
    data: {
      phase: 'planning',
      message: statusMessages[thoroughness],
      thoroughness,
      mode
    }
  }

  try {
    // Determine if this is initial planning or continuation
    const isInitial = messages.length === 0
    const prompt = isInitial
      ? buildInitialPlanningPrompt(mission, thoroughness, mode)
      : buildContinuationPrompt(messages, mission, thoroughness, mode)

    // Generate system prompt based on configuration
    const systemPrompt = queryOptions?.systemPrompt || getPlanningSystemPrompt(thoroughness, mode)

    // Default planning tools (read-only + Task for sub-agents)
    const defaultAllowedTools = ['Read', 'Glob', 'Grep', 'Bash', 'Task']

    // Adjust max turns based on thoroughness
    const maxTurnsMap = {
      quick: 30,
      medium: 50,
      thorough: 100
    }

    for await (const message of query({
      prompt,
      options: {
        cwd: projectPath,
        systemPrompt,
        tools: queryOptions?.tools,
        allowedTools: queryOptions?.allowedTools || defaultAllowedTools,
        disallowedTools: ['Write', 'Edit', ...(queryOptions?.disallowedTools || [])], // Ensure read-only
        mcpServers: queryOptions?.mcpServers,
        plugins: queryOptions?.plugins,
        agents: queryOptions?.agents,
        settingSources: queryOptions?.settingSources,
        permissionMode: 'default', // More restrictive in planning
        maxTurns: maxTurnsMap[thoroughness],
        maxThinkingTokens: thoroughness === 'thorough' ? 32000 : 16000,
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

      // Process SDK messages
      if (message.type === 'assistant' && message.message?.content) {
        for (const block of message.message.content) {
          // Stream thinking blocks (extended thinking / ultrathink mode)
          if ('thinking' in block && typeof (block as { thinking?: string }).thinking === 'string') {
            yield {
              type: 'plan_thinking',
              data: {
                chunk: (block as { thinking: string }).thinking,
                isThinking: true
              }
            }
          }
          // Stream text blocks progressively
          if ('text' in block) {
            fullResponse += block.text
            // Emit chunk immediately for real-time streaming
            yield {
              type: 'plan_stream',
              data: {
                chunk: block.text
              }
            }
          }
        }
      } else if (message.type === 'result') {
        // Emit the full assistant response as a single message
        if (fullResponse.trim()) {
          yield {
            type: 'plan_message',
            data: {
              message: {
                id: `msg-${Date.now()}`,
                role: 'assistant',
                content: fullResponse,
                timestamp: new Date().toISOString()
              }
            }
          }
        }

        // Parse the plan from the full response
        lastPlan = parsePlanFromResponse(fullResponse)

        if (lastPlan) {
          // Yield the structured plan (new simple format)
          const planEventData: PlanEventData = {
            summary: lastPlan.summary,
            approach: lastPlan.approach,
            files: lastPlan.files,
            // Legacy fields for backwards compatibility
            plan: lastPlan.plan,
            estimatedChanges: lastPlan.estimatedChanges,
            risks: lastPlan.risks,
            questions: lastPlan.questions
          }

          yield {
            type: 'plan',
            data: planEventData
          }

          yield {
            type: 'status',
            data: {
              phase: 'planning',
              message: 'Plan ready for review. Waiting for approval...'
            }
          }
        } else {
          // No structured plan found in response
          yield {
            type: 'status',
            data: {
              phase: 'planning',
              message: 'Planning complete. Review the analysis above.'
            }
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

/**
 * Continue planning conversation with user feedback
 * Used when user provides feedback or asks questions
 */
export async function* continuePlanning(
  context: PlanningContext,
  userMessage: string,
  queryOptions?: ResolvedQueryOptions
): AsyncGenerator<PolishEvent> {
  // Add user message to context
  const newMessage: PlanMessage = {
    id: `msg-${Date.now()}`,
    role: 'user',
    content: userMessage,
    timestamp: new Date().toISOString()
  }

  yield {
    type: 'plan_message',
    data: { message: newMessage }
  }

  // Create updated context with new message
  const updatedContext: PlanningContext = {
    ...context,
    messages: [...context.messages, newMessage]
  }

  // Run planning with updated context
  yield* runPlanningPhase(updatedContext, queryOptions)
}

/**
 * Generate a quick plan without full exploration
 * Useful for simple missions or when user wants to skip exploration
 *
 * This uses the 'quick' thoroughness level which:
 * - Does minimal exploration
 * - Generates a simple, direct plan
 * - Uses fewer sub-agent calls
 */
export async function* generateQuickPlan(
  mission: string,
  projectPath: string,
  queryOptions?: ResolvedQueryOptions
): AsyncGenerator<PolishEvent> {
  yield {
    type: 'status',
    data: {
      phase: 'planning',
      message: 'Generating quick plan with minimal exploration...'
    }
  }

  // Simplified context for quick planning with 'quick' thoroughness
  const context: PlanningContext = {
    mission,
    projectPath,
    messages: [],
    thoroughness: 'quick',
    mode: 'agent-driven' // Still use agents but with minimal exploration
  }

  yield* runPlanningPhase(context, queryOptions)
}

/**
 * Generate a thorough plan with deep exploration
 * Useful for complex missions requiring comprehensive analysis
 *
 * This uses the 'thorough' thoroughness level which:
 * - Exhaustive exploration of the codebase
 * - Deep analysis of patterns and conventions
 * - Security and performance considerations
 * - Multiple sub-agent calls for comprehensive coverage
 */
export async function* generateThoroughPlan(
  mission: string,
  projectPath: string,
  queryOptions?: ResolvedQueryOptions
): AsyncGenerator<PolishEvent> {
  yield {
    type: 'status',
    data: {
      phase: 'planning',
      message: 'Generating thorough plan with deep analysis...'
    }
  }

  // Context for thorough planning
  const context: PlanningContext = {
    mission,
    projectPath,
    messages: [],
    thoroughness: 'thorough',
    mode: 'agent-driven'
  }

  yield* runPlanningPhase(context, queryOptions)
}

/**
 * Create a planning context with specified configuration
 * Utility function for custom planning setups
 */
export function createPlanningContext(options: {
  mission: string
  projectPath: string
  thoroughness?: PlanningThoroughness
  mode?: PlanningMode
  messages?: PlanMessage[]
}): PlanningContext {
  return {
    mission: options.mission,
    projectPath: options.projectPath,
    messages: options.messages || [],
    thoroughness: options.thoroughness || 'medium',
    mode: options.mode || 'agent-driven'
  }
}
