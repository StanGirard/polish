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

/**
 * Get the appropriate system prompt based on planning mode and thoroughness
 */
function getPlanningSystemPrompt(
  thoroughness: PlanningThoroughness = 'medium',
  mode: PlanningMode = 'agent-driven'
): string {
  const thoroughnessGuide = {
    quick: `## Niveau: Exploration RAPIDE
- Fais une recherche basique de la structure du projet
- Identifie les fichiers principaux sans lecture approfondie
- Propose un plan simple et direct`,
    medium: `## Niveau: Exploration MODÉRÉE
- Explore la structure du projet en détail
- Lis les fichiers clés pour comprendre les patterns
- Analyse les dépendances principales
- Propose un plan bien réfléchi`,
    thorough: `## Niveau: Exploration APPROFONDIE
- Analyse exhaustive de la structure du projet
- Lis tous les fichiers pertinents en détail
- Comprends profondément les patterns et conventions
- Vérifie les implications de sécurité et de performance
- Propose un plan complet avec alternatives`
  }

  const agentDrivenInstructions = mode === 'agent-driven' ? `
## Utilisation des sous-agents (OBLIGATOIRE)
Tu as accès à des agents spécialisés via l'outil Task. Tu DOIS les utiliser:

### Agents disponibles et quand les utiliser:

1. **Explore** (modèle: small - très rapide)
   - Recherche de fichiers par patterns
   - Recherche de code par mots-clés
   - Compréhension rapide de la structure
   - Utilise: \`{ "subagent_type": "Explore", "prompt": "..." }\`

2. **Plan** (modèle: big - très capable)
   - Conception de plans d'implémentation complexes
   - Décisions architecturales importantes
   - Utilise: \`{ "subagent_type": "Plan", "prompt": "..." }\`

3. **research** (modèle: medium)
   - Questions complexes nécessitant une analyse approfondie
   - Compréhension de concepts multi-fichiers
   - Utilise: \`{ "subagent_type": "research", "prompt": "..." }\`

4. **code-analysis** (modèle: medium)
   - Analyse de fonctions spécifiques
   - Compréhension de flux de données
   - Identification de patterns
   - Utilise: \`{ "subagent_type": "code-analysis", "prompt": "..." }\`

5. **security-review** (modèle: medium)
   - Audit de sécurité du code sensible
   - Identification de vulnérabilités
   - Utilise: \`{ "subagent_type": "security-review", "prompt": "..." }\`

6. **test-analysis** (modèle: small - rapide)
   - Analyse de la couverture de tests
   - Identification des tests manquants
   - Utilise: \`{ "subagent_type": "test-analysis", "prompt": "..." }\`

### Stratégie de planning recommandée:
1. Lance d'abord **Explore** pour comprendre la structure globale
2. Utilise **code-analysis** pour analyser les fichiers clés identifiés
3. Si des aspects de sécurité sont impliqués, lance **security-review**
4. Utilise **Plan** pour concevoir le plan final basé sur les découvertes

### Exécution parallèle:
Tu peux lancer plusieurs agents en parallèle s'ils sont indépendants.
Par exemple: Explore + test-analysis peuvent être lancés ensemble.
` : ''

  return `Tu es un architecte logiciel expert en planification d'implémentation.

${thoroughnessGuide[thoroughness]}
${agentDrivenInstructions}

## Ta mission
Analyser le codebase et proposer un plan d'implémentation détaillé pour la mission demandée.

## Processus de planification

### Phase 1: Exploration
- Comprends la structure du projet
- Identifie les technologies utilisées
- Repère les patterns et conventions

### Phase 2: Analyse
- Lis les fichiers clés
- Comprends les dépendances
- Identifie les points d'extension

### Phase 3: Conception
- Propose un plan d'implémentation
- Identifie les risques
- Suggère des alternatives si pertinent

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
      "order": 1,
      "dependencies": [],
      "complexity": "low|medium|high",
      "testStrategy": "Comment tester cette étape"
    }
  ],
  "estimatedChanges": {
    "filesCreated": ["nouveaux/fichiers.ts"],
    "filesModified": ["fichiers/existants.ts"],
    "filesDeleted": []
  },
  "risks": [
    {
      "description": "Description du risque",
      "severity": "low|medium|high",
      "mitigation": "Comment mitiger ce risque"
    }
  ],
  "securityConsiderations": ["Considérations de sécurité si applicable"],
  "testingPlan": "Stratégie de test globale",
  "questions": ["Question optionnelle pour clarification"]
}
\`\`\`

## Règles strictes
- Ne modifie JAMAIS de fichiers - tu es en mode lecture seule
- Sois précis sur les fichiers et les lignes concernées
- Identifie et réutilise les patterns existants du projet
- Pose des questions si la mission n'est pas claire
- Les étapes doivent être atomiques et testables
- Privilégie la simplicité - évite le sur-engineering`
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
  const thoroughnessHint = {
    quick: 'Fais une exploration rapide et propose un plan simple.',
    medium: 'Explore en détail et propose un plan bien réfléchi.',
    thorough: 'Fais une analyse exhaustive avant de proposer un plan complet.'
  }

  const agentHint = mode === 'agent-driven'
    ? `\n\n## Utilisation des sous-agents
IMPORTANT: Tu DOIS utiliser les sous-agents pour cette tâche:
1. Lance l'agent **Explore** pour comprendre la structure du projet
2. Si nécessaire, utilise **code-analysis** pour analyser les fichiers clés
3. Utilise **Plan** pour concevoir le plan final

Les agents peuvent être lancés en parallèle quand ils sont indépendants.`
    : ''

  return `## Mission à planifier
${mission}

## Niveau d'exploration: ${thoroughness.toUpperCase()}
${thoroughnessHint[thoroughness]}
${agentHint}

## Instructions
1. Explore le codebase pour comprendre sa structure
2. Identifie les fichiers pertinents pour cette mission
3. Analyse les patterns existants à réutiliser
4. Propose un plan d'implémentation détaillé

Commence par explorer le projet avec les agents appropriés, puis génère ton plan au format JSON.`
}

function buildContinuationPrompt(
  messages: PlanMessage[],
  mission: string,
  thoroughness: PlanningThoroughness = 'medium',
  mode: PlanningMode = 'agent-driven'
): string {
  let prompt = `## Mission originale
${mission}

## Niveau d'exploration: ${thoroughness.toUpperCase()}

## Historique de la conversation de planification
`

  // Include all previous messages as context
  for (const msg of messages) {
    const role = msg.role === 'user' ? '👤 Utilisateur' : '🤖 Assistant'
    prompt += `\n### ${role}\n${msg.content}\n`
  }

  const agentHint = mode === 'agent-driven'
    ? `\n## Utilisation des sous-agents
Si tu as besoin d'explorer davantage pour répondre au feedback:
- Utilise **Explore** pour rechercher des fichiers ou du code
- Utilise **code-analysis** pour analyser du code spécifique
- Utilise **Plan** pour retravailler la conception si nécessaire`
    : ''

  prompt += `
## Instructions
Prends en compte tout le contexte et le feedback ci-dessus.
- Analyse les retours de l'utilisateur
- Modifie le plan si nécessaire
- Réponds aux questions soulevées
- Clarifie les points demandés
${agentHint}

Génère un plan révisé au format JSON.`

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

  const toolHook: HookCallback = async (input) => {
    if (input.hook_event_name !== 'PreToolUse' && input.hook_event_name !== 'PostToolUse') {
      return {}
    }

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
