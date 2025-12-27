import Anthropic from '@anthropic-ai/sdk'
import type { Provider, ProviderType } from './types'
import { PROVIDER_BASE_URLS } from './types'

// ============================================================================
// Environment Variable Management
// ============================================================================

// Store original environment values for restoration
let originalEnv: {
  ANTHROPIC_AUTH_TOKEN?: string
  ANTHROPIC_BASE_URL?: string
  OPENROUTER_API_KEY?: string
} | null = null

/**
 * Set environment variables for the Claude Agent SDK
 * Must be called before each SDK query() call
 */
export function setProviderEnvironment(provider: Provider): void {
  // Save original values on first call
  if (originalEnv === null) {
    originalEnv = {
      ANTHROPIC_AUTH_TOKEN: process.env.ANTHROPIC_AUTH_TOKEN,
      ANTHROPIC_BASE_URL: process.env.ANTHROPIC_BASE_URL,
      OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY
    }
  }

  const baseUrl = getProviderBaseUrl(provider)

  // Set environment variables that SDK reads
  process.env.ANTHROPIC_AUTH_TOKEN = provider.apiKey
  process.env.ANTHROPIC_BASE_URL = baseUrl

  // For OpenRouter compatibility
  if (provider.type === 'openrouter') {
    process.env.OPENROUTER_API_KEY = provider.apiKey
  }
}

/**
 * Restore original environment variables
 */
export function clearProviderEnvironment(): void {
  if (originalEnv !== null) {
    if (originalEnv.ANTHROPIC_AUTH_TOKEN !== undefined) {
      process.env.ANTHROPIC_AUTH_TOKEN = originalEnv.ANTHROPIC_AUTH_TOKEN
    } else {
      delete process.env.ANTHROPIC_AUTH_TOKEN
    }

    if (originalEnv.ANTHROPIC_BASE_URL !== undefined) {
      process.env.ANTHROPIC_BASE_URL = originalEnv.ANTHROPIC_BASE_URL
    } else {
      delete process.env.ANTHROPIC_BASE_URL
    }

    if (originalEnv.OPENROUTER_API_KEY !== undefined) {
      process.env.OPENROUTER_API_KEY = originalEnv.OPENROUTER_API_KEY
    } else {
      delete process.env.OPENROUTER_API_KEY
    }

    originalEnv = null
  }
}

// ============================================================================
// Anthropic Client Creation
// ============================================================================

/**
 * Get the base URL for a provider
 */
export function getProviderBaseUrl(provider: Provider): string {
  // Use custom baseUrl if provided, otherwise use default for provider type
  return provider.baseUrl || PROVIDER_BASE_URLS[provider.type]
}

/**
 * Create an Anthropic client for direct SDK usage (e.g., summary generation)
 */
export function createAnthropicClient(provider: Provider): Anthropic {
  const baseURL = getProviderBaseUrl(provider)

  return new Anthropic({
    apiKey: provider.apiKey,
    baseURL
  })
}

/**
 * Get the default model for a provider type
 */
export function getDefaultModelForProvider(type: ProviderType): string {
  switch (type) {
    case 'anthropic':
    case 'anthropic_oauth':
      return 'claude-sonnet-4-5-20250929'
    case 'openrouter':
      return 'anthropic/claude-sonnet-4.5'
    case 'glm':
      return 'GLM-4.7'  // Z.ai GLM model (uppercase required)
    case 'openai_compatible':
      return 'gpt-5.1'
    default:
      return 'claude-sonnet-4-5-20250929'
  }
}

// ============================================================================
// Async Generator Wrapper
// ============================================================================

/**
 * Wrap an async generator with provider environment setup/cleanup
 * Ensures environment is properly set before execution and cleaned up after
 */
export async function* withProviderEnvironment<T>(
  provider: Provider,
  generator: () => AsyncGenerator<T>
): AsyncGenerator<T> {
  setProviderEnvironment(provider)
  try {
    yield* generator()
  } finally {
    clearProviderEnvironment()
  }
}

/**
 * Run a function with provider environment set, cleaning up after
 */
export async function runWithProviderEnvironment<T>(
  provider: Provider,
  fn: () => Promise<T>
): Promise<T> {
  setProviderEnvironment(provider)
  try {
    return await fn()
  } finally {
    clearProviderEnvironment()
  }
}

// ============================================================================
// Provider Validation
// ============================================================================

/**
 * Test if a provider connection works by making a minimal API call
 */
export async function testProviderConnection(provider: Provider): Promise<{ success: boolean; error?: string }> {
  try {
    const client = createAnthropicClient(provider)
    const model = provider.model || getDefaultModelForProvider(provider.type)

    // Make a minimal API call
    await client.messages.create({
      model,
      max_tokens: 10,
      messages: [{ role: 'user', content: 'test' }]
    })

    return { success: true }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Connection failed'
    return { success: false, error: message }
  }
}

// ============================================================================
// Fallback to Environment Variables
// ============================================================================

/**
 * Create a "virtual" provider from environment variables
 * Used when no providers are configured in the database
 */
export function getProviderFromEnvironment(): Provider | undefined {
  const apiKey = process.env.ANTHROPIC_AUTH_TOKEN || process.env.OPENROUTER_API_KEY
  const baseUrl = process.env.ANTHROPIC_BASE_URL

  if (!apiKey) {
    return undefined
  }

  // Determine provider type from base URL
  let type: ProviderType = 'anthropic'
  if (baseUrl?.includes('openrouter')) {
    type = 'openrouter'
  } else if (baseUrl?.includes('z.ai') || baseUrl?.includes('bigmodel')) {
    type = 'glm'
  }

  return {
    id: 'env',
    name: 'Environment Variables',
    type,
    baseUrl: baseUrl || undefined,
    apiKey,
    isDefault: true,
    createdAt: new Date(),
    updatedAt: new Date()
  }
}
