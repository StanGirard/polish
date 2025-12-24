import {
  query,
  type HookCallback,
  type PreToolUseHookInput,
  type PostToolUseHookInput
} from '@anthropic-ai/claude-agent-sdk'
import { commitWithMessage, getStatus } from './git'
import type { AgentEventData, PolishEvent, ResolvedQueryOptions } from './types'
import { createToolLogger } from './tool-logger'

// ============================================================================
// Implementation Phase (Phase 1)
// ============================================================================

interface ImplementPromptOptions {
  mission: string
  feedback?: string
  retryCount?: number
}

function buildImplementPrompt(options: ImplementPromptOptions): string {
  const { mission, feedback, retryCount } = options

  let prompt = `Tu dois implémenter la fonctionnalité suivante dans ce projet:

## Mission
${mission}
`

  // Ajouter le feedback si c'est un retry
  if (feedback && retryCount && retryCount > 0) {
    prompt += `
## Feedback utilisateur (Tentative #${retryCount + 1})
L'utilisateur n'était pas satisfait de l'implémentation précédente. Voici son feedback:

> ${feedback}

**Important**: Prends en compte ce feedback et corrige/améliore l'implémentation en conséquence.
Analyse ce qui a été fait précédemment et applique les corrections demandées.
`
  }

  prompt += `
## Instructions
1. D'abord, explore le projet avec Glob et Read pour comprendre:
   - La structure du projet
   - Les patterns et conventions utilisés
   - Les fichiers pertinents à modifier ou créer
${feedback ? '   - Ce qui a déjà été implémenté (pour le retry)\n' : ''}
2. Ensuite, implémente la fonctionnalité:
   - Crée les nouveaux fichiers nécessaires avec Write
   - Modifie les fichiers existants avec Edit
   - Assure-toi que le code compile (pas d'erreurs de syntaxe)
${feedback ? '   - Applique les corrections demandées dans le feedback\n' : ''}
3. Le code peut être imparfait:
   - Des warnings sont acceptables
   - Des types incomplets sont acceptables
   - Le code sera polish automatiquement après

## Important
- Suis les conventions du projet existant
- Utilise les patterns déjà en place
- Préfère Edit à Write pour modifier des fichiers existants
- Ne touche pas aux fichiers de config sans raison
${feedback ? '- PRIORITÉ: Adresse le feedback utilisateur en premier\n' : ''}
Commence par explorer le projet, puis implémente la fonctionnalité.`

  return prompt
}

const IMPLEMENT_SYSTEM_PROMPT = `Tu es un développeur expert. Ta mission est d'implémenter une fonctionnalité dans un projet existant.

## Ton approche
1. **Explorer** - Comprendre le projet, sa structure, ses patterns
2. **Planifier** - Identifier les fichiers à créer/modifier
3. **Implémenter** - Écrire le code nécessaire
4. **Vérifier** - S'assurer que le code compile

## Outils disponibles
- Glob: trouver des fichiers par pattern
- Grep: chercher du texte dans les fichiers
- Read: lire un fichier
- Write: créer un nouveau fichier
- Edit: modifier un fichier existant (préféré à Write pour les modifications)
- Bash: exécuter des commandes (npm, tsc, etc.)

## Règles
- Suis les conventions du projet
- Le code doit compiler (pas d'erreurs de syntaxe)
- Les warnings et types incomplets sont acceptables
- Préfère des changements incrémentaux`

export interface ImplementPhaseOptions {
  mission: string
  projectPath: string
  feedback?: string
  retryCount?: number
  queryOptions?: ResolvedQueryOptions
}

export async function* runImplementPhase(
  options: ImplementPhaseOptions
): AsyncGenerator<PolishEvent> {
  const { mission, projectPath, feedback, retryCount, queryOptions } = options
  // Track files modified by the agent
  const filesCreated: string[] = []
  const filesModified: string[] = []
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

    // Track file operations
    if (toolInput.hook_event_name === 'PostToolUse') {
      eventData.output = (toolInput as PostToolUseHookInput).tool_response

      // Track Write operations (new files)
      if (toolInput.tool_name === 'Write') {
        const filePath = (toolInput.tool_input as { file_path?: string })?.file_path
        if (filePath && !filesCreated.includes(filePath)) {
          filesCreated.push(filePath)
        }
      }

      // Track Edit operations (modified files)
      if (toolInput.tool_name === 'Edit') {
        const filePath = (toolInput.tool_input as { file_path?: string })?.file_path
        if (filePath && !filesModified.includes(filePath) && !filesCreated.includes(filePath)) {
          filesModified.push(filePath)
        }
      }
    }

    hookEvents.push({ type: 'agent', data: eventData })
    return {}
  }

  try {
    // Start implement phase
    yield {
      type: 'phase',
      data: { phase: 'implement', mission }
    }

    yield {
      type: 'status',
      data: { phase: 'implement', message: 'Starting implementation...' }
    }

    // Auto-continuation support
    const MAX_CONTINUATIONS = 5
    let sessionId: string | undefined
    let continuationCount = 0
    let shouldContinue = true

    while (shouldContinue && continuationCount <= MAX_CONTINUATIONS) {
      const isResume = sessionId !== undefined
      const prompt = isResume
        ? 'Continue implementing the remaining features.'
        : buildImplementPrompt({ mission, feedback, retryCount })

      // Default tools for implement phase
      const defaultAllowedTools = ['Read', 'Write', 'Edit', 'Bash', 'Glob', 'Grep']

      for await (const message of query({
        prompt,
        options: {
          cwd: projectPath,
          systemPrompt: queryOptions?.systemPrompt || IMPLEMENT_SYSTEM_PROMPT,
          // Use resolved tools or defaults
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
              type: 'status',
              data: {
                phase: 'implement',
                message: `Continuing implementation (${continuationCount}/${MAX_CONTINUATIONS})...`
              }
            }
            break // Break inner loop, continue outer while loop
          } else {
            // Success or other completion - exit
            yield {
              type: 'status',
              data: {
                phase: 'implement',
                message: message.subtype === 'success'
                  ? 'Implementation complete'
                  : `Implementation stopped: ${message.subtype}`
              }
            }
            shouldContinue = false
          }
        }
      }
    }

    if (continuationCount > MAX_CONTINUATIONS) {
      yield {
        type: 'status',
        data: {
          phase: 'implement',
          message: 'Implementation reached maximum continuations limit'
        }
      }
    }

    // Check if any files were modified
    const status = await getStatus(projectPath)
    if (!status.hasChanges && filesCreated.length === 0 && filesModified.length === 0) {
      yield {
        type: 'status',
        data: { phase: 'implement', message: 'No changes made during implementation' }
      }
      return
    }

    // Create a summary commit message
    const shortMission = mission.length > 50 ? mission.slice(0, 47) + '...' : mission
    const commitMessage = `feat: ${shortMission} (WIP)`
    const commitHash = await commitWithMessage(projectPath, commitMessage)

    yield {
      type: 'implement_done',
      data: {
        commitHash,
        message: commitMessage,
        filesCreated,
        filesModified
      }
    }

    yield {
      type: 'status',
      data: {
        phase: 'implement',
        message: `Committed: ${commitMessage}`
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
        message: `Implementation failed: ${error instanceof Error ? error.message : String(error)}`
      }
    }
  }
}
