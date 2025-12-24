import OpenAI from 'openai'
import type { FileChange, LLMResponse } from './types'

const OPENROUTER_URL = 'https://openrouter.ai/api/v1'
const MODEL = 'zhipu-ai/glm-4-plus'

let totalTokensUsed = 0

function getClient(): OpenAI {
  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY environment variable is not set')
  }

  return new OpenAI({
    baseURL: OPENROUTER_URL,
    apiKey,
    defaultHeaders: {
      'HTTP-Referer': 'https://github.com/polish-dev/polish',
      'X-Title': 'Polish',
    },
  })
}

interface Message {
  role: 'system' | 'user' | 'assistant'
  content: string
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function prompt(
  messages: Message[],
  options: { maxRetries?: number; timeout?: number } = {}
): Promise<string> {
  const { maxRetries = 3, timeout = 120000 } = options
  const client = getClient()

  let lastError: Error | null = null

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), timeout)

      const response = await client.chat.completions.create(
        {
          model: MODEL,
          messages,
          max_tokens: 8192,
        },
        { signal: controller.signal }
      )

      clearTimeout(timeoutId)

      // Track token usage
      if (response.usage) {
        totalTokensUsed += response.usage.total_tokens || 0
      }

      const content = response.choices[0]?.message?.content
      if (!content) {
        throw new Error('Empty response from LLM')
      }

      return content
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))

      // Exponential backoff
      const delay = Math.pow(2, attempt) * 1000
      console.log(`LLM attempt ${attempt + 1} failed: ${lastError.message}. Retrying in ${delay}ms...`)
      await sleep(delay)
    }
  }

  throw lastError || new Error('Failed to get LLM response')
}

export function parseResponse(response: string): LLMResponse {
  // Check for SKIP response
  if (response.trim() === 'SKIP' || response.includes('\nSKIP\n') || response.endsWith('\nSKIP')) {
    return {
      explanation: 'No changes to make for this strategy',
      files: [],
      skip: true,
      tokensUsed: 0,
    }
  }

  const files: FileChange[] = []

  // Parse file blocks with format: ```filepath:/path/to/file.ts
  const fileBlockRegex = /```filepath:([^\n]+)\n([\s\S]*?)```/g
  let match

  while ((match = fileBlockRegex.exec(response)) !== null) {
    const path = match[1].trim()
    const content = match[2]

    files.push({ path, content })
  }

  // Extract explanation (first line or paragraph before code blocks)
  const explanationMatch = response.match(/^([^`]+)/)
  const explanation = explanationMatch ? explanationMatch[1].trim().split('\n')[0] : ''

  return {
    explanation,
    files,
    skip: false,
    tokensUsed: 0,
  }
}

export function getTotalTokensUsed(): number {
  return totalTokensUsed
}

export function resetTokenCount(): void {
  totalTokensUsed = 0
}

export function estimateCost(tokens: number): number {
  // GLM-4 pricing estimate (adjust based on actual pricing)
  // Roughly $0.001 per 1K tokens
  return (tokens / 1000) * 0.001
}

export function buildPrompt(
  config: { rules: string[] },
  score: { total: number; details: Record<string, number>; diagnostics: Record<string, string> },
  failures: { strategy: string; target: string; reason: string }[],
  strategy: { prompt: string },
  fileContents?: Record<string, string>
): Message[] {
  const messages: Message[] = [
    {
      role: 'system',
      content: `Tu es un expert en amélioration de code. Tu dois faire UN SEUL changement atomique pour améliorer le score de qualité.

## Règles
${config.rules.map((r) => `- ${r}`).join('\n')}

## Format de réponse
Réponds UNIQUEMENT avec:
1. Une ligne d'explication courte
2. Les blocs de code à modifier au format:

\`\`\`filepath:/chemin/vers/fichier.ts
contenu complet du fichier
\`\`\`

Si tu dois créer un nouveau fichier, utilise le même format.
Si tu ne trouves rien à améliorer pour cette stratégie, réponds exactement: SKIP`,
    },
    {
      role: 'user',
      content: `## Score actuel: ${score.total.toFixed(1)}/100

### Détail par métrique
${Object.entries(score.details)
  .map(([k, v]) => `- ${k}: ${v.toFixed(1)}/100`)
  .join('\n')}

### Diagnostics
${Object.entries(score.diagnostics).map(([k, v]) => `- ${k}: ${v}`).join('\n') || 'Aucun diagnostic'}

## Échecs récents à éviter
${failures.slice(-5).map((f) => `- ${f.strategy} sur ${f.target}: ${f.reason}`).join('\n') || 'Aucun'}

${fileContents ? `## Fichiers du projet\n${Object.entries(fileContents).map(([path, content]) => `### ${path}\n\`\`\`\n${content}\n\`\`\``).join('\n\n')}` : ''}

## Ta mission
${strategy.prompt}`,
    },
  ]

  return messages
}
