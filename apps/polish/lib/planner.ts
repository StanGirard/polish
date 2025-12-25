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
  plan: PlanStep[]
  summary: string
  confidence?: number
  approach?: string
  alternativeApproaches?: Array<{
    name: string
    description: string
    pros: string[]
    cons: string[]
    whyNotChosen: string
  }>
  estimatedChanges: {
    filesCreated: string[]
    filesModified: string[]
    filesDeleted: string[]
    totalLinesAdded?: number
    totalLinesModified?: number
    totalLinesDeleted?: number
  }
  risks: Array<{
    description: string
    severity?: 'low' | 'medium' | 'high'
    probability?: 'low' | 'medium' | 'high'
    impact?: string
    mitigation?: string
    contingency?: string
  } | string>
  dependencies?: {
    external?: string[]
    internal?: string[]
    breaking?: string[]
  }
  securityConsiderations?: Array<{
    area: string
    concern: string
    recommendation: string
  }>
  performanceConsiderations?: Array<{
    area: string
    concern: string
    optimization: string
  }>
  testingPlan?: {
    unitTests?: string[]
    integrationTests?: string[]
    e2eTests?: string[]
    manualTests?: string[]
  }
  documentation?: {
    filesToUpdate?: string[]
    newDocumentation?: string[]
  }
  questions?: string[]
  assumptions?: string[]
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
Tu as accès à des agents spécialisés via l'outil Task. Tu DOIS les utiliser pour une planification efficace.

### 🔍 Agents d'EXPLORATION (Phase 1 - Lancer en parallèle)

1. **Explore** (modèle: small - ultra-rapide, ~10s)
   - 📁 Recherche de fichiers par patterns glob (ex: "src/**/*.tsx")
   - 🔎 Recherche de code par mots-clés (ex: "API endpoints", "authentication")
   - 🗂️ Cartographie de la structure du projet
   - 📊 Identification des technologies et frameworks utilisés
   - Utilise: \`{ "subagent_type": "Explore", "prompt": "Find all files related to..." }\`
   - **Exemple**: "Find all React components in src/, identify the routing structure, and list API endpoints"

2. **dependency-analysis** (modèle: small - rapide, ~15s)
   - 📦 Analyse du package.json et des dépendances
   - 🔗 Mapping des imports entre modules
   - ⚠️ Détection de dépendances circulaires
   - 📈 Identification des versions obsolètes
   - Utilise: \`{ "subagent_type": "dependency-analysis", "prompt": "..." }\`
   - **Exemple**: "Analyze the dependency graph for the authentication module"

### 🔬 Agents d'ANALYSE (Phase 2 - Après exploration)

3. **code-analysis** (modèle: medium - ~30s)
   - 🧬 Analyse approfondie de fonctions et classes spécifiques
   - 📊 Compréhension des flux de données (entrées → sorties)
   - 🎯 Identification des patterns de conception utilisés
   - 🔄 Analyse des états et mutations
   - 📍 Localisation des points d'extension et hooks
   - Utilise: \`{ "subagent_type": "code-analysis", "prompt": "..." }\`
   - **Exemple**: "Analyze the UserService class, trace data flow from API to database"

4. **architecture-review** (modèle: medium - ~45s)
   - 🏗️ Évaluation de l'architecture globale du système
   - 📐 Vérification des principes SOLID et clean architecture
   - 🔀 Analyse des patterns de communication (sync/async, events, etc.)
   - 📋 Identification des bounded contexts et domaines
   - Utilise: \`{ "subagent_type": "architecture-review", "prompt": "..." }\`
   - **Exemple**: "Review the overall architecture, identify coupling issues and suggest improvements"

5. **research** (modèle: medium - ~30s)
   - 📚 Questions complexes nécessitant analyse multi-fichiers
   - 🧠 Compréhension de concepts transversaux
   - 🔍 Investigation de comportements spécifiques
   - 📖 Documentation des conventions du projet
   - Utilise: \`{ "subagent_type": "research", "prompt": "..." }\`
   - **Exemple**: "How does error handling work across the application? What patterns are used?"

### 🛡️ Agents de QUALITÉ (Phase 2-3 - Selon besoin)

6. **security-review** (modèle: medium - ~45s)
   - 🔒 Audit de sécurité du code sensible (auth, crypto, inputs)
   - 🛡️ Vérification OWASP Top 10 (XSS, injection, CSRF, etc.)
   - 🔑 Analyse de la gestion des secrets et tokens
   - ⚡ Identification des vulnérabilités potentielles
   - Utilise: \`{ "subagent_type": "security-review", "prompt": "..." }\`
   - **Exemple**: "Audit the authentication flow for security vulnerabilities"

7. **performance-review** (modèle: medium - ~30s)
   - ⚡ Identification des goulots d'étranglement potentiels
   - 💾 Analyse de l'utilisation mémoire et fuites
   - 🔄 Détection des re-renders inutiles (React)
   - 📊 Évaluation de la complexité algorithmique
   - 🗄️ Analyse des requêtes N+1 et optimisations DB
   - Utilise: \`{ "subagent_type": "performance-review", "prompt": "..." }\`
   - **Exemple**: "Analyze performance bottlenecks in the data loading pipeline"

8. **test-analysis** (modèle: small - rapide, ~15s)
   - ✅ Évaluation de la couverture de tests existante
   - 🧪 Identification des cas de test manquants
   - 📋 Analyse de la qualité des tests (mocks, assertions)
   - 🎯 Recommandations de tests à ajouter
   - Utilise: \`{ "subagent_type": "test-analysis", "prompt": "..." }\`
   - **Exemple**: "Analyze test coverage for the payment module, identify missing edge cases"

### 📋 Agent de CONCEPTION (Phase 3 - Final)

9. **Plan** (modèle: big - très capable, ~60s)
   - 🎨 Conception de plans d'implémentation détaillés
   - 🏛️ Décisions architecturales importantes
   - ⚖️ Évaluation des trade-offs entre approches
   - 📊 Estimation de la complexité et des risques
   - Utilise: \`{ "subagent_type": "Plan", "prompt": "..." }\`
   - **Exemple**: "Based on the exploration results, design a detailed implementation plan for..."

### 🎯 Stratégie de planning recommandée:

**Phase 1 - Exploration rapide (en parallèle):**
\`\`\`
Explore + dependency-analysis + test-analysis
\`\`\`
→ Comprendre la structure, les dépendances et l'état des tests

**Phase 2 - Analyse ciblée (basée sur Phase 1):**
\`\`\`
code-analysis (fichiers clés identifiés)
+ architecture-review (si changements structurels)
+ security-review (si code sensible détecté)
+ performance-review (si optimisation nécessaire)
\`\`\`
→ Analyser en profondeur les zones impactées

**Phase 3 - Conception (synthèse):**
\`\`\`
Plan (avec toutes les découvertes des phases précédentes)
\`\`\`
→ Générer le plan d'implémentation final

### ⚡ Exécution parallèle:
Lance TOUJOURS les agents indépendants en parallèle pour gagner du temps.
Exemples de groupes parallélisables:
- Explore + dependency-analysis + test-analysis (Phase 1)
- security-review + performance-review (si tous deux nécessaires)
- code-analysis sur différents modules
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
  "confidence": 0.85,
  "approach": "Description de l'approche choisie et pourquoi",
  "alternativeApproaches": [
    {
      "name": "Nom de l'alternative",
      "description": "Description brève",
      "pros": ["Avantage 1", "Avantage 2"],
      "cons": ["Inconvénient 1"],
      "whyNotChosen": "Raison de ne pas choisir cette approche"
    }
  ],
  "plan": [
    {
      "id": "step-1",
      "title": "Titre court de l'étape",
      "description": "Description détaillée de ce qui sera fait",
      "rationale": "Pourquoi cette étape est nécessaire",
      "files": ["chemin/vers/fichier1.ts", "chemin/vers/fichier2.ts"],
      "order": 1,
      "dependencies": [],
      "complexity": "low|medium|high",
      "estimatedLines": 50,
      "testStrategy": "Comment tester cette étape",
      "rollbackPlan": "Comment annuler cette étape si nécessaire",
      "acceptanceCriteria": ["Critère 1", "Critère 2"]
    }
  ],
  "estimatedChanges": {
    "filesCreated": ["nouveaux/fichiers.ts"],
    "filesModified": ["fichiers/existants.ts"],
    "filesDeleted": [],
    "totalLinesAdded": 200,
    "totalLinesModified": 50,
    "totalLinesDeleted": 10
  },
  "risks": [
    {
      "description": "Description du risque",
      "severity": "low|medium|high",
      "probability": "low|medium|high",
      "impact": "Description de l'impact si le risque se matérialise",
      "mitigation": "Comment mitiger ce risque",
      "contingency": "Plan de contingence si le risque se produit"
    }
  ],
  "dependencies": {
    "external": ["Dépendances npm à ajouter"],
    "internal": ["Modules internes requis"],
    "breaking": ["Changements breaking potentiels"]
  },
  "securityConsiderations": [
    {
      "area": "Zone concernée (auth, data, network)",
      "concern": "Description de la considération",
      "recommendation": "Recommandation de sécurité"
    }
  ],
  "performanceConsiderations": [
    {
      "area": "Zone concernée",
      "concern": "Impact potentiel sur la performance",
      "optimization": "Optimisation recommandée"
    }
  ],
  "testingPlan": {
    "unitTests": ["Tests unitaires à ajouter"],
    "integrationTests": ["Tests d'intégration à ajouter"],
    "e2eTests": ["Tests E2E si nécessaire"],
    "manualTests": ["Tests manuels recommandés"]
  },
  "documentation": {
    "filesToUpdate": ["README.md", "docs/api.md"],
    "newDocumentation": ["Nouvelle doc à créer si nécessaire"]
  },
  "questions": ["Question optionnelle pour clarification"],
  "assumptions": ["Hypothèses faites pendant la planification"]
}
\`\`\`

## Règles strictes
- Ne modifie JAMAIS de fichiers - tu es en mode lecture seule
- Sois précis sur les fichiers et les lignes concernées
- Identifie et réutilise les patterns existants du projet
- Pose des questions si la mission n'est pas claire
- Les étapes doivent être atomiques et testables
- Privilégie la simplicité - évite le sur-engineering
- Chaque étape doit avoir des critères d'acceptation clairs
- Identifie les risques ET leurs mitigations concrètes
- Considère toujours les impacts sur la sécurité et la performance
- Documente les hypothèses faites pendant la planification

## Bonnes pratiques
- Commence TOUJOURS par l'exploration avant de planifier
- Utilise les agents en PARALLÈLE quand possible (gain de temps 2-3x)
- Synthétise les découvertes de chaque agent avant de passer à la suite
- Si un agent retourne des informations incomplètes, relance-le avec un prompt plus précis
- Le plan final doit être basé sur des faits découverts, pas sur des suppositions
- Indique ton niveau de confiance (0.0-1.0) dans le plan proposé
- Si la confiance est < 0.7, explique ce qui manque et pose des questions`
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
    ? `\n## Utilisation des sous-agents pour approfondir
Si tu as besoin d'explorer davantage pour répondre au feedback:
- **Explore** → Rechercher des fichiers ou patterns supplémentaires
- **code-analysis** → Analyser du code spécifique mentionné dans le feedback
- **architecture-review** → Revoir les décisions architecturales si contestées
- **security-review** → Approfondir les aspects sécurité si demandé
- **performance-review** → Analyser les impacts performance si questionné
- **Plan** → Retravailler la conception globale si nécessaire

Lance les agents pertinents en parallèle pour répondre efficacement.`
    : ''

  prompt += `
## Instructions de révision
Prends en compte tout le contexte et le feedback ci-dessus:

1. **Analyse le feedback** - Comprends précisément ce qui est demandé
2. **Explore si nécessaire** - Utilise les agents pour clarifier les points flous
3. **Révise le plan** - Modifie les étapes impactées par le feedback
4. **Justifie les changements** - Explique pourquoi tu as modifié le plan
5. **Maintiens la cohérence** - Vérifie que le plan reste cohérent après modifications
${agentHint}

## Format de réponse
- Si le feedback demande des clarifications → Réponds aux questions puis génère le plan révisé
- Si le feedback demande des modifications → Génère directement le plan révisé avec les changements
- Si le feedback valide le plan → Confirme et génère le plan final

Génère toujours un plan complet au format JSON (pas de diff partiel).`

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
        rationale: step.rationale,
        files: step.files || [],
        order: step.order ?? index + 1,
        dependencies: step.dependencies,
        complexity: step.complexity,
        estimatedLines: step.estimatedLines,
        testStrategy: step.testStrategy,
        rollbackPlan: step.rollbackPlan,
        acceptanceCriteria: step.acceptanceCriteria
      })),
      summary: parsed.summary || '',
      confidence: parsed.confidence,
      approach: parsed.approach,
      alternativeApproaches: parsed.alternativeApproaches,
      estimatedChanges: {
        filesCreated: parsed.estimatedChanges?.filesCreated || [],
        filesModified: parsed.estimatedChanges?.filesModified || [],
        filesDeleted: parsed.estimatedChanges?.filesDeleted || [],
        totalLinesAdded: parsed.estimatedChanges?.totalLinesAdded,
        totalLinesModified: parsed.estimatedChanges?.totalLinesModified,
        totalLinesDeleted: parsed.estimatedChanges?.totalLinesDeleted
      },
      risks: parsed.risks || [],
      dependencies: parsed.dependencies,
      securityConsiderations: parsed.securityConsiderations,
      performanceConsiderations: parsed.performanceConsiderations,
      testingPlan: parsed.testingPlan,
      documentation: parsed.documentation,
      questions: parsed.questions,
      assumptions: parsed.assumptions
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
          // Yield the structured plan with all enriched data
          const planEventData: PlanEventData = {
            plan: lastPlan.plan,
            summary: lastPlan.summary,
            confidence: lastPlan.confidence,
            approach: lastPlan.approach,
            alternativeApproaches: lastPlan.alternativeApproaches,
            estimatedChanges: lastPlan.estimatedChanges,
            risks: lastPlan.risks,
            dependencies: lastPlan.dependencies,
            securityConsiderations: lastPlan.securityConsiderations,
            performanceConsiderations: lastPlan.performanceConsiderations,
            testingPlan: lastPlan.testingPlan,
            documentation: lastPlan.documentation,
            questions: lastPlan.questions,
            assumptions: lastPlan.assumptions
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
