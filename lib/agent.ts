import {
  query,
  type HookCallback,
  type PreToolUseHookInput,
  type PostToolUseHookInput
} from '@anthropic-ai/claude-agent-sdk'
import type {
  AgentEventData,
  FailedAttempt,
  MetricResult,
  PolishEvent,
  Strategy
} from './types'

// ============================================================================
// Single Fix Agent
// ============================================================================

export interface SingleFixContext {
  projectPath: string
  strategy: Strategy
  targetMetric: MetricResult
  failedAttempts: FailedAttempt[]
  rules: string[]
}

export interface SingleFixResult {
  success: boolean
  message?: string
}

function buildSingleFixPrompt(context: SingleFixContext): string {
  const { strategy, targetMetric, failedAttempts, rules } = context

  let prompt = `Tu dois corriger UN SEUL problème dans ce codebase.

## Métrique à améliorer
- **${targetMetric.name}**: ${targetMetric.rawValue} (score: ${targetMetric.normalizedScore.toFixed(1)}/100)
- Objectif: ${targetMetric.target}
- ${targetMetric.higherIsBetter ? 'Plus haut = mieux' : 'Plus bas = mieux'}

## Ta tâche
${strategy.prompt}

## Règles strictes
${rules.map(r => `- ${r}`).join('\n')}
- UN SEUL changement atomique
- Vérifie que les tests passent après la modification`

  if (failedAttempts.length > 0) {
    prompt += `\n\n## Tentatives échouées (ne pas répéter)
${failedAttempts.map(f => `- ${f.strategy}${f.file ? ` sur ${f.file}` : ''}${f.line ? `:${f.line}` : ''} → ${f.reason}`).join('\n')}`
  }

  prompt += `\n\nCommence par analyser le problème, puis applique le fix.`

  return prompt
}

function buildSystemPrompt(rules: string[]): string {
  return `Tu es un agent expert en amélioration de qualité de code.

## Ton approche
1. **Analyser** - Utilise les commandes de diagnostic (lint, tsc, tests)
2. **Identifier** - Trouve le problème spécifique à corriger
3. **Corriger** - Applique UN SEUL fix minimal
4. **Vérifier** - Confirme que le fix fonctionne

## Règles
${rules.map(r => `- ${r}`).join('\n')}

## Outils disponibles
- Glob: trouver des fichiers par pattern
- Grep: chercher du texte dans les fichiers
- Read: lire un fichier
- Edit: modifier un fichier (préféré)
- Bash: exécuter des commandes (lint, tsc, npm test)

## Important
- Préfère Edit à Write pour modifier des fichiers existants
- Ne modifie pas les fichiers de config sans raison
- Un seul changement atomique par session`
}

export async function* runSingleFix(
  context: SingleFixContext
): AsyncGenerator<PolishEvent> {
  const { projectPath, rules } = context

  // Queue pour les events des hooks
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

    if (toolInput.hook_event_name === 'PostToolUse') {
      eventData.output = (toolInput as PostToolUseHookInput).tool_response
    }

    hookEvents.push({ type: 'agent', data: eventData })
    return {}
  }

  try {
    const systemPrompt = buildSystemPrompt(rules)

    // Auto-continuation support (same as implement.ts)
    const MAX_CONTINUATIONS = 5
    let sessionId: string | undefined
    let continuationCount = 0
    let shouldContinue = true

    while (shouldContinue && continuationCount <= MAX_CONTINUATIONS) {
      const isResume = sessionId !== undefined
      const prompt = isResume
        ? 'Continue le fix en cours.'
        : buildSingleFixPrompt(context)

      for await (const message of query({
        prompt,
        options: {
          cwd: projectPath,
          systemPrompt,
          allowedTools: ['Read', 'Edit', 'Bash', 'Glob', 'Grep'],
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
              type: 'agent',
              data: {
                message: `Continuing fix (${continuationCount}/${MAX_CONTINUATIONS})...`
              }
            }
            break // Break inner loop, continue outer while loop
          } else {
            // Success or other completion - exit
            yield {
              type: 'agent',
              data: {
                message: message.subtype === 'success'
                  ? 'Fix applied successfully'
                  : `Agent stopped: ${message.subtype}`
              }
            }
            shouldContinue = false
          }
        }
      }
    }

    if (continuationCount > MAX_CONTINUATIONS) {
      yield {
        type: 'agent',
        data: {
          message: 'Fix reached maximum continuations limit'
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

// ============================================================================
// Legacy: Full Polish Agent (for backward compatibility)
// ============================================================================

const LEGACY_SYSTEM_PROMPT = `Tu es un agent expert en amélioration de qualité de code. Ta mission:

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

export async function* runPolishAgent(
  repoPath: string,
  maxTurns: number = 20
): AsyncGenerator<PolishEvent> {
  const hookEvents: PolishEvent[] = []

  const toolHook: HookCallback = async (input) => {
    if (input.hook_event_name !== 'PreToolUse' && input.hook_event_name !== 'PostToolUse') {
      return {}
    }

    const toolInput = input as PreToolUseHookInput | PostToolUseHookInput
    const event: PolishEvent = {
      type: 'agent',
      data: {
        tool: toolInput.tool_name,
        input: toolInput.tool_input,
        phase: toolInput.hook_event_name
      }
    }

    if (toolInput.hook_event_name === 'PostToolUse') {
      event.data.output = (toolInput as PostToolUseHookInput).tool_response
    }

    hookEvents.push(event)
    return {}
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
        systemPrompt: LEGACY_SYSTEM_PROMPT,
        allowedTools: ['Read', 'Edit', 'Bash', 'Glob', 'Grep'],
        permissionMode: 'acceptEdits',
        maxTurns,
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
      while (hookEvents.length > 0) {
        yield hookEvents.shift()!
      }

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
        for (const block of message.message.content) {
          if ('text' in block) {
            yield {
              type: 'agent',
              data: { message: block.text }
            }
          }
        }
      } else if (message.type === 'result') {
        yield {
          type: 'result',
          data: {
            success: message.subtype === 'success',
            initialScore: 0,
            finalScore: 0,
            commits: [],
            iterations: message.num_turns,
            cost: message.total_cost_usd,
            duration: message.duration_ms
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
