import { query, type HookCallback, type PreToolUseHookInput, type PostToolUseHookInput } from '@anthropic-ai/claude-agent-sdk'

const SYSTEM_PROMPT = `Tu es un agent expert en amélioration de qualité de code. Ta mission:

1. **Analyser** le codebase:
   - Exécute \`npm run lint\` ou \`npx eslint . --format json\` pour les erreurs lint
   - Exécute \`npx tsc --noEmit\` pour les erreurs TypeScript
   - Exécute \`npm test\` pour vérifier les tests

2. **Prioriser** les problèmes par impact:
   - Erreurs critiques (empêchent la compilation)
   - Erreurs de type
   - Erreurs de lint
   - Warnings

3. **Fixer** UN problème à la fois:
   - Lis le fichier concerné avec Read
   - Applique le fix minimal avec Edit
   - Vérifie que le fix fonctionne (recompile, relint)

4. **Itérer** jusqu'à ce que le code soit propre

## Règles strictes
- UN SEUL changement atomique par itération
- Toujours vérifier que les tests passent après chaque modification
- Ne jamais toucher aux fichiers de config (package.json, tsconfig.json) sans raison valide
- Préférer supprimer du code mort plutôt qu'ajouter du code
- Utilise Glob et Grep pour explorer le codebase avant d'agir`

export interface PolishEvent {
  type: 'status' | 'tool' | 'assistant' | 'result' | 'error'
  data: {
    phase?: string
    message?: string
    tool?: string
    input?: unknown
    output?: unknown
    success?: boolean
    turns?: number
    cost?: number
    duration?: number
    sessionId?: string
    [key: string]: unknown
  }
}

export async function* runPolishAgent(
  repoPath: string,
  maxTurns: number = 20
): AsyncGenerator<PolishEvent> {
  // Queue pour stocker les events des hooks
  const hookEvents: PolishEvent[] = []

  // Hook pour capturer les tool calls
  const toolHook: HookCallback = async (input, _toolUseId) => {
    // Only process PreToolUse and PostToolUse events
    if (input.hook_event_name !== 'PreToolUse' && input.hook_event_name !== 'PostToolUse') {
      return {}
    }

    const toolInput = input as PreToolUseHookInput | PostToolUseHookInput
    const event: PolishEvent = {
      type: 'tool',
      data: {
        tool: toolInput.tool_name,
        input: toolInput.tool_input,
        phase: toolInput.hook_event_name
      }
    }

    // Ajouter le résultat si c'est un PostToolUse
    if (toolInput.hook_event_name === 'PostToolUse') {
      event.data.output = (toolInput as PostToolUseHookInput).tool_response
    }

    hookEvents.push(event)
    return {} // Continue l'exécution
  }

  try {
    yield {
      type: 'status',
      data: { phase: 'init', message: 'Starting polish agent...' }
    }

    for await (const message of query({
      prompt: `Analyse et améliore la qualité du code dans ce répertoire.

Étapes:
1. D'abord, explore le projet avec Glob pour comprendre sa structure
2. Exécute les outils de qualité (lint, typecheck, tests)
3. Identifie les problèmes à corriger
4. Corrige-les un par un en vérifiant après chaque fix

Commence maintenant.`,
      options: {
        cwd: repoPath,
        systemPrompt: SYSTEM_PROMPT,
        allowedTools: ['Read', 'Edit', 'Bash', 'Glob', 'Grep'],
        permissionMode: 'acceptEdits',
        maxTurns,
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
      // D'abord, yield tous les events de hooks accumulés
      while (hookEvents.length > 0) {
        yield hookEvents.shift()!
      }

      // Traiter le message SDK
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
        // Extraire le texte du message assistant
        for (const block of message.message.content) {
          if ('text' in block) {
            yield {
              type: 'assistant',
              data: { message: block.text }
            }
          }
        }
      } else if (message.type === 'result') {
        yield {
          type: 'result',
          data: {
            success: message.subtype === 'success',
            turns: message.num_turns,
            cost: message.total_cost_usd,
            duration: message.duration_ms,
            message: message.subtype === 'success'
              ? (message as any).result
              : `Stopped: ${message.subtype}`
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
