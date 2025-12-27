import { getDb } from './session-store'
import type {
  Provider,
  ProviderMasked,
  ProviderType,
  CreateProviderRequest,
  UpdateProviderRequest
} from './types'

// ============================================================================
// Helpers
// ============================================================================

function generateId(): string {
  return `prov-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

/**
 * Mask an API key for safe display
 * Shows first 3 chars and last 4 chars, e.g., "sk-...abc1"
 */
export function maskApiKey(apiKey: string): string {
  if (apiKey.length <= 8) {
    return '***'
  }
  const prefix = apiKey.slice(0, 3)
  const suffix = apiKey.slice(-4)
  return `${prefix}...${suffix}`
}

function rowToProvider(row: Record<string, unknown>): Provider {
  return {
    id: row.id as string,
    name: row.name as string,
    type: row.type as ProviderType,
    baseUrl: row.base_url as string | undefined,
    apiKey: row.api_key as string,
    model: row.model as string | undefined,
    isDefault: Boolean(row.is_default),
    createdAt: new Date(row.created_at as string),
    updatedAt: new Date(row.updated_at as string)
  }
}

function providerToMasked(provider: Provider): ProviderMasked {
  return {
    id: provider.id,
    name: provider.name,
    type: provider.type,
    baseUrl: provider.baseUrl,
    apiKeyMasked: maskApiKey(provider.apiKey),
    model: provider.model,
    isDefault: provider.isDefault,
    createdAt: provider.createdAt,
    updatedAt: provider.updatedAt
  }
}

// ============================================================================
// CRUD Operations
// ============================================================================

/**
 * Create a new provider
 */
export function createProvider(config: CreateProviderRequest): Provider {
  const db = getDb()
  const id = generateId()
  const now = new Date()

  // If this is the first provider or isDefault is true, make it default
  const existingProviders = getAllProviders()
  const shouldBeDefault = config.isDefault || existingProviders.length === 0

  // If this should be default, unset other defaults first
  if (shouldBeDefault) {
    db.prepare('UPDATE providers SET is_default = 0').run()
  }

  const provider: Provider = {
    id,
    name: config.name,
    type: config.type,
    baseUrl: config.baseUrl,
    apiKey: config.apiKey,
    model: config.model,
    isDefault: shouldBeDefault,
    createdAt: now,
    updatedAt: now
  }

  db.prepare(`
    INSERT INTO providers (id, name, type, base_url, api_key, model, is_default, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    provider.name,
    provider.type,
    provider.baseUrl || null,
    provider.apiKey,
    provider.model || null,
    shouldBeDefault ? 1 : 0,
    now.toISOString(),
    now.toISOString()
  )

  return provider
}

/**
 * Get a provider by ID (with full API key)
 */
export function getProvider(id: string): Provider | undefined {
  const db = getDb()
  const row = db.prepare('SELECT * FROM providers WHERE id = ?').get(id) as Record<string, unknown> | undefined

  if (!row) return undefined
  return rowToProvider(row)
}

/**
 * Get a provider by ID with masked API key (safe for API responses)
 */
export function getProviderMasked(id: string): ProviderMasked | undefined {
  const provider = getProvider(id)
  if (!provider) return undefined
  return providerToMasked(provider)
}

/**
 * Get all providers (with full API keys)
 */
export function getAllProviders(): Provider[] {
  const db = getDb()
  const rows = db.prepare('SELECT * FROM providers ORDER BY created_at DESC').all() as Record<string, unknown>[]
  return rows.map(rowToProvider)
}

/**
 * Get all providers with masked API keys (safe for API responses)
 */
export function getAllProvidersMasked(): ProviderMasked[] {
  const providers = getAllProviders()
  return providers.map(providerToMasked)
}

/**
 * Get the default provider (with full API key)
 */
export function getDefaultProvider(): Provider | undefined {
  const db = getDb()
  const row = db.prepare('SELECT * FROM providers WHERE is_default = 1').get() as Record<string, unknown> | undefined

  if (!row) {
    // If no default, return the first provider
    const firstRow = db.prepare('SELECT * FROM providers ORDER BY created_at ASC LIMIT 1').get() as Record<string, unknown> | undefined
    if (!firstRow) return undefined
    return rowToProvider(firstRow)
  }

  return rowToProvider(row)
}

/**
 * Update a provider
 */
export function updateProvider(id: string, updates: UpdateProviderRequest): void {
  const db = getDb()
  const now = new Date()

  const fields: string[] = ['updated_at = ?']
  const values: unknown[] = [now.toISOString()]

  if (updates.name !== undefined) {
    fields.push('name = ?')
    values.push(updates.name)
  }
  if (updates.baseUrl !== undefined) {
    fields.push('base_url = ?')
    values.push(updates.baseUrl || null)
  }
  if (updates.apiKey !== undefined) {
    fields.push('api_key = ?')
    values.push(updates.apiKey)
  }
  if (updates.model !== undefined) {
    fields.push('model = ?')
    values.push(updates.model || null)
  }
  if (updates.isDefault !== undefined) {
    // If setting as default, unset other defaults first
    if (updates.isDefault) {
      db.prepare('UPDATE providers SET is_default = 0').run()
    }
    fields.push('is_default = ?')
    values.push(updates.isDefault ? 1 : 0)
  }

  values.push(id)
  db.prepare(`UPDATE providers SET ${fields.join(', ')} WHERE id = ?`).run(...values)
}

/**
 * Delete a provider
 * Returns true if deleted, false if provider was in use
 */
export function deleteProvider(id: string): { success: boolean; error?: string } {
  const db = getDb()

  // Check if provider exists
  const provider = getProvider(id)
  if (!provider) {
    return { success: false, error: 'Provider not found' }
  }

  // Check if provider is used by any session
  const sessionsUsingProvider = db.prepare(
    'SELECT COUNT(*) as count FROM sessions WHERE provider_id = ?'
  ).get(id) as { count: number }

  if (sessionsUsingProvider.count > 0) {
    return {
      success: false,
      error: `Provider is used by ${sessionsUsingProvider.count} session(s). Please update those sessions first.`
    }
  }

  // If this was the default provider, set a new default
  if (provider.isDefault) {
    const otherProvider = db.prepare(
      'SELECT id FROM providers WHERE id != ? ORDER BY created_at ASC LIMIT 1'
    ).get(id) as { id: string } | undefined

    if (otherProvider) {
      db.prepare('UPDATE providers SET is_default = 1 WHERE id = ?').run(otherProvider.id)
    }
  }

  // Delete the provider
  db.prepare('DELETE FROM providers WHERE id = ?').run(id)

  return { success: true }
}

/**
 * Set a provider as the default
 */
export function setDefaultProvider(id: string): void {
  const db = getDb()

  // Unset all defaults
  db.prepare('UPDATE providers SET is_default = 0').run()

  // Set the new default
  db.prepare('UPDATE providers SET is_default = 1 WHERE id = ?').run(id)
}

/**
 * Check if any providers are configured
 */
export function hasProviders(): boolean {
  const db = getDb()
  const result = db.prepare('SELECT COUNT(*) as count FROM providers').get() as { count: number }
  return result.count > 0
}

/**
 * Get provider count
 */
export function getProviderCount(): number {
  const db = getDb()
  const result = db.prepare('SELECT COUNT(*) as count FROM providers').get() as { count: number }
  return result.count
}
