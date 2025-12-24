import {
  query,
  type HookCallback,
  type PreToolUseHookInput,
  type PostToolUseHookInput
} from '@anthropic-ai/claude-agent-sdk'
import { commitWithMessage, getStatus } from './git'
import type { AgentEventData, PolishEvent } from './types'

// ============================================================================
// Implementation Phase (Phase 1)
// ============================================================================

function buildImplementPrompt(mission: string): string {
  return `Tu dois implémenter la fonctionnalité suivante dans ce projet:

## Mission
${mission}

## Instructions
1. D'abord, explore le projet avec Glob et Read pour comprendre:
   - La structure du projet
   - Les patterns et conventions utilisés
   - Les fichiers pertinents à modifier ou créer

2. Ensuite, implémente la fonctionnalité:
   - Crée les nouveaux fichiers nécessaires avec Write
   - Modifie les fichiers existants avec Edit
   - Assure-toi que le code compile (pas d'erreurs de syntaxe)

3. Le code peut être imparfait:
   - Des warnings sont acceptables
   - Des types incomplets sont acceptables
   - Le code sera polish automatiquement après

## Important
- Suis les conventions du projet existant
- Utilise les patterns déjà en place
- Préfère Edit à Write pour modifier des fichiers existants
- Ne touche pas aux fichiers de config sans raison

Commence par explorer le projet, puis implémente la fonctionnalité.`
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

export async function* runImplementPhase(
  mission: string,
  projectPath: string
): AsyncGenerator<PolishEvent> {
  // Track files modified by the agent
  const filesCreated: string[] = []
  const filesModified: string[] = []
  const hookEvents: PolishEvent[] = []

  const toolHook: HookCallback = async (input) => {
    if (input.hook_event_name !== 'PreToolUse' && input.hook_event_name !== 'PostToolUse') {
      return {}
    }

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
        : buildImplementPrompt(mission)

      for await (const message of query({
        prompt,
        options: {
          cwd: projectPath,
          systemPrompt: IMPLEMENT_SYSTEM_PROMPT,
          allowedTools: ['Read', 'Write', 'Edit', 'Bash', 'Glob', 'Grep'],
          permissionMode: 'acceptEdits',
          maxTurns: 30,
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

  } catch (error) {
    yield {
      type: 'error',
      data: {
        message: `Implementation failed: ${error instanceof Error ? error.message : String(error)}`
      }
    }
  }
}
