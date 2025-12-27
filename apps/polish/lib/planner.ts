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
  PlanningMode,
  PlanQuestion
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
  type: 'question' | 'plan'
  question?: PlanQuestion      // If type === 'question'
  markdown?: string            // If type === 'plan' - the full markdown plan
  plan?: PlanStep[]            // Parsed plan steps from markdown (optional)
}

// ============================================================================
// System Prompt for Planning
// ============================================================================

/**
 * Get the appropriate system prompt based on planning mode and thoroughness
 * Style Claude Code: questions interactives puis UN SEUL plan markdown
 */
function getPlanningSystemPrompt(
  thoroughness: PlanningThoroughness = 'medium',
  mode: PlanningMode = 'agent-driven'
): string {
  const thoroughnessGuide = {
    quick: `## Thoroughness: QUICK
- Basic search of project structure
- Identify main files without deep reading
- Propose a simple and direct plan`,
    medium: `## Thoroughness: MEDIUM
- Explore project structure in detail
- Read key files to understand patterns
- Analyze main dependencies
- Propose a well-thought-out plan`,
    thorough: `## Thoroughness: THOROUGH
- Exhaustive analysis of project structure
- Read all relevant files in detail
- Deeply understand patterns and conventions
- Check security and performance implications
- Propose complete plan with alternatives`
  }

  const agentDrivenInstructions = mode === 'agent-driven' ? `
## Sub-agents Available (USE THEM)
You have access to specialized agents via the Task tool. Use them proactively:

- **Explore** (small model, fast): File search specialist. Use for finding files by patterns, searching code.
- **Plan** (big model, capable): Software architect. Use for detailed implementation planning.
- **research** (medium model): Deep investigation. Use for complex multi-source analysis.
- **code-analysis** (medium model): Code comprehension. Use for understanding functions, data flow.
- **security-review** (medium model): Security auditing. Use for sensitive code.
- **test-analysis** (small model, fast): Test coverage analysis.
- **general-purpose** (medium model): Multi-step autonomous tasks.

## Recommended Strategy
1. Use **Explore** first to understand project structure
2. Use **code-analysis** to understand patterns in key files
3. Use **Plan** to design the implementation plan
4. Use **security-review** if security-sensitive code involved

Launch agents in parallel when they are independent.
` : ''

  return `You are a software architect and planning specialist.

${thoroughnessGuide[thoroughness]}
${agentDrivenInstructions}

=== CRITICAL: READ-ONLY MODE - NO FILE MODIFICATIONS ===

This is a READ-ONLY planning task. You are STRICTLY PROHIBITED from:
- Creating new files (no Write, touch, or file creation)
- Modifying existing files (no Edit operations)
- Deleting files (no rm or deletion)
- Running ANY commands that change system state

## Your Planning Process

1. EXPLORE
   - Understand project structure
   - Identify technologies used
   - Find patterns and conventions

2. CLARIFY (optional but encouraged)
   - If you need to clarify requirements, pose a question
   - Maximum 2-3 questions before generating the plan
   - Use the question format below

3. DESIGN
   - After gathering info, propose ONE implementation plan
   - Use markdown format for the plan

## Phase de clarification

Avant de générer le plan, tu PEUX poser des questions pour clarifier les besoins.
Format pour une question (IMPORTANT: utilise exactement ce format avec \`\`\`question):

\`\`\`question
{
  "id": "q1",
  "text": "Comment souhaitez-vous gérer X ?",
  "options": [
    {"id": "opt1", "label": "Option A (Recommandé)", "description": "Description de l'option A"},
    {"id": "opt2", "label": "Option B", "description": "Description de l'option B"},
    {"id": "opt3", "label": "Option C", "description": "Description de l'option C"}
  ],
  "recommended": "opt1"
}
\`\`\`

Pose MAXIMUM 2-3 questions pertinentes. Après les réponses, génère le plan.

## Format du plan final

Génère UN SEUL plan en markdown (IMPORTANT: utilise exactement ce format avec \`\`\`plan):

\`\`\`plan
# Plan d'implémentation

## Résumé
[1-2 phrases décrivant l'approche choisie]

## Étapes

### 1. [Titre de l'étape]
- **Fichiers**: \`path/to/file.ts\`, \`path/to/other.ts\`
- **Description**: Ce qui sera fait en détail
- **Changements**:
  - Ajouter X
  - Modifier Y
  - Créer Z

### 2. [Titre de l'étape]
- **Fichiers**: \`path/to/file.ts\`
- **Description**: Ce qui sera fait
- **Changements**:
  - ...

## Fichiers impactés
- \`file1.ts\` - Raison du changement
- \`file2.ts\` - Raison du changement
\`\`\`

## Guidelines
- Never modify files - read-only mode
- Be precise about files and lines
- Reuse existing project patterns
- Ask questions if mission is unclear
- Steps should be atomic and testable
- Prefer simplicity - avoid over-engineering
- Generate ONE plan, not multiple approaches`
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
    quick: 'Do a quick exploration and propose a simple plan.',
    medium: 'Explore in detail and propose a well-thought-out plan.',
    thorough: 'Do an exhaustive analysis before proposing a complete plan.'
  }

  const agentHint = mode === 'agent-driven'
    ? `\n\n## Using Sub-agents
IMPORTANT: You SHOULD use sub-agents for this task:
1. Use **Explore** agent to understand the project structure
2. If needed, use **code-analysis** to analyze key files
3. Use **Plan** agent to design the final implementation plan

Agents can be launched in parallel when they are independent.`
    : ''

  return `## Mission to Plan
${mission}

## Thoroughness Level: ${thoroughness.toUpperCase()}
${thoroughnessHint[thoroughness]}
${agentHint}

## Instructions
1. Explore the codebase to understand its structure
2. Identify relevant files for this mission
3. Analyze existing patterns to reuse
4. Propose a detailed implementation plan

Start by exploring the project with appropriate agents, then generate your plan in JSON format.`
}

function buildContinuationPrompt(
  messages: PlanMessage[],
  mission: string,
  thoroughness: PlanningThoroughness = 'medium',
  mode: PlanningMode = 'agent-driven'
): string {
  let prompt = `## Original Mission
${mission}

## Thoroughness Level: ${thoroughness.toUpperCase()}

## Planning Conversation History
`

  // Include all previous messages as context
  for (const msg of messages) {
    const role = msg.role === 'user' ? 'User' : 'Assistant'
    prompt += `\n### ${role}\n${msg.content}\n`
  }

  const agentHint = mode === 'agent-driven'
    ? `\n## Using Sub-agents for Further Exploration
If you need to explore more to respond to feedback:
- **Explore** - Find additional files or patterns
- **code-analysis** - Analyze specific code mentioned in feedback
- **security-review** - Investigate security aspects if requested
- **Plan** - Rework the overall design if needed

Launch relevant agents in parallel for efficiency.`
    : ''

  prompt += `
## Revision Instructions
Take into account all context and feedback above:

1. **Analyze feedback** - Understand precisely what is requested
2. **Explore if needed** - Use agents to clarify unclear points
3. **Revise plan** - Modify steps impacted by feedback
4. **Justify changes** - Explain why you modified the plan
5. **Maintain coherence** - Verify the plan remains coherent after modifications
${agentHint}

## Response Format
- If feedback asks for clarifications - Answer questions then generate revised plan
- If feedback requests modifications - Generate revised plan directly with changes
- If feedback validates the plan - Confirm and generate final plan

Always generate a complete plan in JSON format (no partial diffs).`

  return prompt
}

// ============================================================================
// Response Parser
// ============================================================================

/**
 * Parse questions and plans from the LLM response
 * Detects ```question and ```plan blocks
 */
function parsePlanFromResponse(text: string): PlanningResult | null {
  // First check for question block
  const questionMatch = text.match(/```question\s*([\s\S]*?)\s*```/)
  if (questionMatch) {
    try {
      const parsed = JSON.parse(questionMatch[1])
      if (parsed.id && parsed.text && Array.isArray(parsed.options)) {
        return {
          type: 'question',
          question: {
            id: parsed.id,
            text: parsed.text,
            options: parsed.options.map((opt: { id?: string; label?: string; description?: string }, idx: number) => ({
              id: opt.id || `opt-${idx + 1}`,
              label: opt.label || `Option ${idx + 1}`,
              description: opt.description
            })),
            recommended: parsed.recommended
          }
        }
      }
    } catch {
      // Invalid JSON in question block
    }
  }

  // Check for plan block (markdown)
  const planMatch = text.match(/```plan\s*([\s\S]*?)\s*```/)
  if (planMatch) {
    const markdown = planMatch[1].trim()

    // Optionally parse steps from markdown (basic extraction)
    const steps = parseStepsFromMarkdown(markdown)

    return {
      type: 'plan',
      markdown,
      plan: steps.length > 0 ? steps : undefined
    }
  }

  return null
}

/**
 * Parse plan steps from markdown format
 * Extracts ### numbered sections as steps
 */
function parseStepsFromMarkdown(markdown: string): PlanStep[] {
  const steps: PlanStep[] = []

  // Match ### N. Title sections
  const stepRegex = /###\s*(\d+)\.\s*([^\n]+)\n([\s\S]*?)(?=###\s*\d+\.|## |$)/g
  let match

  while ((match = stepRegex.exec(markdown)) !== null) {
    const order = parseInt(match[1], 10)
    const title = match[2].trim()
    const content = match[3].trim()

    // Extract files from **Fichiers**: `file1`, `file2` pattern
    const filesMatch = content.match(/\*\*Fichiers?\*\*:\s*([^\n]+)/)
    const files: string[] = []
    if (filesMatch) {
      const fileRefs = filesMatch[1].match(/`([^`]+)`/g)
      if (fileRefs) {
        files.push(...fileRefs.map(f => f.replace(/`/g, '')))
      }
    }

    // Extract description
    const descMatch = content.match(/\*\*Description\*\*:\s*([^\n]+)/)
    const description = descMatch ? descMatch[1].trim() : content.split('\n')[0]

    steps.push({
      id: `step-${order}`,
      title,
      description,
      files,
      order,
      complexity: 'medium' // Default
    })
  }

  return steps
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

      // Handle tool progress for real-time visibility during long-running operations
      if (message.type === 'tool_progress') {
        const isSubAgent = message.tool_name === 'Task'

        yield {
          type: 'agent',
          data: {
            phase: 'InProgress',
            tool: message.tool_name,
            elapsedTime: message.elapsed_time_seconds,
            toolUseId: message.tool_use_id,
            parentToolUseId: message.parent_tool_use_id,
            message: isSubAgent
              ? `Sub-agent running... (${message.elapsed_time_seconds.toFixed(1)}s)`
              : `${message.tool_name} in progress... (${message.elapsed_time_seconds.toFixed(1)}s)`
          }
        }
        continue
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

        // Parse question or plan from the full response
        lastPlan = parsePlanFromResponse(fullResponse)

        if (lastPlan) {
          if (lastPlan.type === 'question' && lastPlan.question) {
            // Emit question for user to answer
            yield {
              type: 'plan_question',
              data: {
                question: lastPlan.question
              }
            }

            yield {
              type: 'status',
              data: {
                phase: 'planning',
                message: 'Question en attente de réponse...'
              }
            }
          } else if (lastPlan.type === 'plan' && lastPlan.markdown) {
            // Emit the final markdown plan
            const planEventData: PlanEventData = {
              markdown: lastPlan.markdown
            }

            yield {
              type: 'plan',
              data: planEventData
            }

            yield {
              type: 'status',
              data: {
                phase: 'planning',
                message: 'Plan ready for review. Approve or provide feedback...'
              }
            }
          }
        } else {
          // No structured content found in response
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
