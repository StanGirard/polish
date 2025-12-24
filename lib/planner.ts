/**
 * Planning Phase for Polish
 *
 * Interactive planning phase where the LLM explores the codebase
 * and proposes an implementation plan that the user can iterate on.
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
  PlanEventData
} from './types'

// ============================================================================
// Planning Context
// ============================================================================

export interface PlanningContext {
  mission: string
  projectPath: string
  messages: PlanMessage[]  // Conversation history
}

export interface PlanningResult {
  plan: PlanStep[]
  summary: string
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

const PLANNING_SYSTEM_PROMPT = `Tu es un architecte logiciel expert en planification d'implémentation.

## Ta mission
Analyser le codebase et proposer un plan d'implémentation détaillé pour la mission demandée.

## Ton approche
1. **Explorer** - Utilise Glob et Grep pour comprendre la structure du projet
2. **Analyser** - Lis les fichiers clés pour comprendre les patterns existants
3. **Planifier** - Propose un plan d'implémentation clair et actionnable

## Format de réponse
Tu DOIS retourner un plan structuré au format JSON dans un bloc \`\`\`json:

\`\`\`json
{
  "summary": "Résumé en 1-2 phrases de ce que le plan accomplit",
  "plan": [
    {
      "id": "step-1",
      "title": "Titre court de l'étape",
      "description": "Description détaillée de ce qui sera fait",
      "files": ["chemin/vers/fichier1.ts", "chemin/vers/fichier2.ts"],
      "order": 1
    }
  ],
  "estimatedChanges": {
    "filesCreated": ["nouveaux/fichiers.ts"],
    "filesModified": ["fichiers/existants.ts"],
    "filesDeleted": []
  },
  "risks": ["Risque potentiel 1", "Risque potentiel 2"],
  "questions": ["Question optionnelle pour clarification"]
}
\`\`\`

## Règles
- Ne modifie JAMAIS de fichiers - tu es en mode lecture seule
- Sois précis sur les fichiers et les lignes concernées
- Identifie les patterns existants à réutiliser
- Pose des questions si la mission n'est pas claire
- Les étapes doivent être atomiques et testables`

// ============================================================================
// Prompt Builders
// ============================================================================

function buildInitialPlanningPrompt(mission: string): string {
  return `## Mission à planifier
${mission}

## Instructions
1. Explore le codebase pour comprendre sa structure
2. Identifie les fichiers pertinents pour cette mission
3. Propose un plan d'implémentation détaillé

Commence par explorer le projet, puis génère ton plan au format JSON.`
}

function buildContinuationPrompt(userMessage: string, previousPlan?: PlanningResult): string {
  let prompt = `## Feedback utilisateur
${userMessage}

## Instructions
Prends en compte le feedback et:`

  if (previousPlan) {
    prompt += `
- Modifie le plan existant si nécessaire
- Réponds aux questions posées
- Clarifie les points soulevés`
  }

  prompt += `

Génère un plan mis à jour au format JSON.`

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

    // Validate required fields
    if (!parsed.plan || !Array.isArray(parsed.plan)) {
      return null
    }

    return {
      plan: parsed.plan.map((step: Partial<PlanStep>, index: number) => ({
        id: step.id || `step-${index + 1}`,
        title: step.title || `Étape ${index + 1}`,
        description: step.description || '',
        files: step.files || [],
        order: step.order ?? index + 1
      })),
      summary: parsed.summary || '',
      estimatedChanges: {
        filesCreated: parsed.estimatedChanges?.filesCreated || [],
        filesModified: parsed.estimatedChanges?.filesModified || [],
        filesDeleted: parsed.estimatedChanges?.filesDeleted || []
      },
      risks: parsed.risks || [],
      questions: parsed.questions
    }
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
 */
export async function* runPlanningPhase(
  context: PlanningContext,
  queryOptions?: ResolvedQueryOptions
): AsyncGenerator<PolishEvent> {
  const { mission, projectPath, messages } = context

  // Queue for hook events
  const hookEvents: PolishEvent[] = []
  let fullResponse = ''
  let lastPlan: PlanningResult | null = null

  const toolHook: HookCallback = async (input) => {
    if (input.hook_event_name !== 'PreToolUse' && input.hook_event_name !== 'PostToolUse') {
      return {}
    }

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

  yield {
    type: 'status',
    data: {
      phase: 'planning',
      message: 'Exploring codebase and generating implementation plan...'
    }
  }

  try {
    // Determine if this is initial planning or continuation
    const isInitial = messages.length === 0
    const prompt = isInitial
      ? buildInitialPlanningPrompt(mission)
      : buildContinuationPrompt(messages[messages.length - 1].content, lastPlan || undefined)

    // Default planning tools (read-only)
    const defaultAllowedTools = ['Read', 'Glob', 'Grep', 'Bash', 'Task']

    for await (const message of query({
      prompt,
      options: {
        cwd: projectPath,
        systemPrompt: queryOptions?.systemPrompt || PLANNING_SYSTEM_PROMPT,
        tools: queryOptions?.tools,
        allowedTools: queryOptions?.allowedTools || defaultAllowedTools,
        disallowedTools: ['Write', 'Edit', ...(queryOptions?.disallowedTools || [])], // Ensure read-only
        mcpServers: queryOptions?.mcpServers,
        plugins: queryOptions?.plugins,
        agents: queryOptions?.agents,
        settingSources: queryOptions?.settingSources,
        permissionMode: 'default', // More restrictive in planning
        maxTurns: 50, // Allow extensive exploration
        maxThinkingTokens: 16000,
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
          if ('text' in block) {
            fullResponse += block.text

            // Yield as plan_message for streaming
            yield {
              type: 'plan_message',
              data: {
                message: {
                  id: `msg-${Date.now()}`,
                  role: 'assistant',
                  content: block.text,
                  timestamp: new Date().toISOString()
                }
              }
            }
          }
        }
      } else if (message.type === 'result') {
        // Parse the plan from the full response
        lastPlan = parsePlanFromResponse(fullResponse)

        if (lastPlan) {
          // Yield the structured plan
          const planEventData: PlanEventData = {
            plan: lastPlan.plan,
            summary: lastPlan.summary,
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
  previousPlan: PlanningResult | null,
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
      message: 'Generating quick plan...'
    }
  }

  // Simplified context for quick planning
  const context: PlanningContext = {
    mission,
    projectPath,
    messages: []
  }

  yield* runPlanningPhase(context, queryOptions)
}
