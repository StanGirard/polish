'use client'

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { apiFetch } from '@/app/lib/api-client'

// ============================================================================
// Types
// ============================================================================

export type ProviderType =
  | 'anthropic'
  | 'anthropic_oauth'
  | 'openrouter'
  | 'glm'
  | 'openai_compatible'

export interface ProviderMasked {
  id: string
  name: string
  type: ProviderType
  baseUrl?: string
  apiKeyMasked: string
  model?: string
  isDefault: boolean
  createdAt: string
  updatedAt: string
}

export interface CreateProviderRequest {
  name: string
  type: ProviderType
  baseUrl?: string
  apiKey: string
  model?: string
  isDefault?: boolean
}

export interface UpdateProviderRequest {
  name?: string
  baseUrl?: string
  apiKey?: string
  model?: string
  isDefault?: boolean
}

interface ProviderContextValue {
  providers: ProviderMasked[]
  defaultProvider: ProviderMasked | null
  isLoading: boolean
  error: string | null
  hasProviders: boolean
  refreshProviders: () => Promise<void>
  createProvider: (config: CreateProviderRequest) => Promise<ProviderMasked>
  updateProvider: (id: string, updates: UpdateProviderRequest) => Promise<void>
  deleteProvider: (id: string) => Promise<void>
  testProvider: (id: string) => Promise<{ success: boolean; error?: string }>
  setDefaultProvider: (id: string) => Promise<void>
}

// ============================================================================
// Context
// ============================================================================

const ProviderContext = createContext<ProviderContextValue | null>(null)

export function ProviderProvider({ children }: { children: React.ReactNode }) {
  const [providers, setProviders] = useState<ProviderMasked[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Fetch providers on mount
  const refreshProviders = useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)
      const response = await apiFetch('/api/providers')
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch providers')
      }

      setProviders(data.providers || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch providers')
      console.error('Failed to fetch providers:', err)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    refreshProviders()
  }, [refreshProviders])

  // Create a new provider
  const createProvider = useCallback(async (config: CreateProviderRequest): Promise<ProviderMasked> => {
    const response = await apiFetch('/api/providers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config)
    })

    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.error || 'Failed to create provider')
    }

    // Refresh the list
    await refreshProviders()

    return data.provider
  }, [refreshProviders])

  // Update a provider
  const updateProvider = useCallback(async (id: string, updates: UpdateProviderRequest): Promise<void> => {
    const response = await apiFetch(`/api/providers/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates)
    })

    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.error || 'Failed to update provider')
    }

    // Refresh the list
    await refreshProviders()
  }, [refreshProviders])

  // Delete a provider
  const deleteProvider = useCallback(async (id: string): Promise<void> => {
    const response = await apiFetch(`/api/providers/${id}`, {
      method: 'DELETE'
    })

    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.error || 'Failed to delete provider')
    }

    // Refresh the list
    await refreshProviders()
  }, [refreshProviders])

  // Test a provider connection
  const testProvider = useCallback(async (id: string): Promise<{ success: boolean; error?: string }> => {
    const response = await apiFetch(`/api/providers/${id}/test`, {
      method: 'POST'
    })

    const data = await response.json()

    return {
      success: data.success,
      error: data.error
    }
  }, [])

  // Set a provider as default
  const setDefaultProvider = useCallback(async (id: string): Promise<void> => {
    await updateProvider(id, { isDefault: true })
  }, [updateProvider])

  // Computed values
  const defaultProvider = providers.find(p => p.isDefault) || null
  const hasProviders = providers.length > 0

  return (
    <ProviderContext.Provider
      value={{
        providers,
        defaultProvider,
        isLoading,
        error,
        hasProviders,
        refreshProviders,
        createProvider,
        updateProvider,
        deleteProvider,
        testProvider,
        setDefaultProvider
      }}
    >
      {children}
    </ProviderContext.Provider>
  )
}

export function useProviders(): ProviderContextValue {
  const context = useContext(ProviderContext)
  if (!context) {
    throw new Error('useProviders must be used within a ProviderProvider')
  }
  return context
}

// ============================================================================
// Constants
// ============================================================================

export const PROVIDER_TYPE_LABELS: Record<ProviderType, string> = {
  anthropic: 'Anthropic (API Key)',
  anthropic_oauth: 'Anthropic (OAuth)',
  openrouter: 'OpenRouter',
  glm: 'GLM / Z.ai',
  openai_compatible: 'OpenAI Compatible'
}

export const PROVIDER_BASE_URLS: Record<ProviderType, string> = {
  anthropic: 'https://api.anthropic.com',
  anthropic_oauth: 'https://api.anthropic.com',
  openrouter: 'https://openrouter.ai/api/v1',
  glm: 'https://api.z.ai/api/anthropic',  // Z.ai/GLM uses Anthropic-compatible API
  openai_compatible: ''
}

export const PROVIDER_DEFAULT_MODELS: Record<ProviderType, string> = {
  anthropic: 'claude-sonnet-4-5-20250929',
  anthropic_oauth: 'claude-sonnet-4-5-20250929',
  openrouter: 'anthropic/claude-sonnet-4.5',
  glm: 'GLM-4.7',
  openai_compatible: 'gpt-5.1'
}

export const PROVIDER_MODEL_OPTIONS: Record<ProviderType, string[]> = {
  anthropic: [
    'claude-opus-4-5-20251101',
    'claude-sonnet-4-5-20250929',
    'claude-haiku-4-5-20251001'
  ],
  anthropic_oauth: [
    'claude-opus-4-5-20251101',
    'claude-sonnet-4-5-20250929',
    'claude-haiku-4-5-20251001',
  ],
  openrouter: [
    'anthropic/claude-opus-4.5',
    'anthropic/claude-sonnet-4.5',
    'anthropic/claude-haiku-4.5',
    'openai/gpt-5.1',
    'openai/gpt-5.1-codex-max',
    'openai/gpt-5-mini',
    'google/gemini-3-flash-preview',
    'google/gemini-3-pro-preview'
  ],
  glm: [
    'GLM-4.7'
  ],
  openai_compatible: [
    'gpt-5.1',
    'gpt-5.1-codex-max',
    'gpt-5-mini',
    'gpt-5',
  ]
}
