'use client'

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import {
  getApiBaseUrl,
  setApiBaseUrl as setStoredApiBaseUrl,
  testBackendConnection,
  isValidApiUrl,
} from '@/app/lib/api-client'

interface ApiConfig {
  baseUrl: string
  isConfigured: boolean // true if using custom backend URL
  isConnected: boolean // true if last connection test passed
  connectionError: string | null
  isLoading: boolean
}

interface ApiConfigContextValue {
  config: ApiConfig
  setBaseUrl: (url: string) => Promise<{ success: boolean; error?: string }>
  testConnection: () => Promise<{ success: boolean; error?: string }>
  clearConfig: () => void
}

const ApiConfigContext = createContext<ApiConfigContextValue | null>(null)

export function ApiConfigProvider({ children }: { children: React.ReactNode }) {
  const [config, setConfig] = useState<ApiConfig>({
    baseUrl: '',
    isConfigured: false,
    isConnected: true, // Assume connected for same-origin
    connectionError: null,
    isLoading: true,
  })

  // Initialize from localStorage on mount
  useEffect(() => {
    const storedUrl = getApiBaseUrl()
    setConfig((prev) => ({
      ...prev,
      baseUrl: storedUrl,
      isConfigured: !!storedUrl,
      isLoading: false,
    }))

    // If there's a stored URL, test the connection
    if (storedUrl) {
      testBackendConnection().then((result) => {
        setConfig((prev) => ({
          ...prev,
          isConnected: result.success,
          connectionError: result.error || null,
        }))
      })
    }
  }, [])

  const setBaseUrl = useCallback(
    async (url: string): Promise<{ success: boolean; error?: string }> => {
      // Validate URL
      if (!isValidApiUrl(url)) {
        return { success: false, error: 'Invalid URL format' }
      }

      // Save to localStorage
      setStoredApiBaseUrl(url)

      // Update state
      setConfig((prev) => ({
        ...prev,
        baseUrl: url,
        isConfigured: !!url,
        isLoading: true,
      }))

      // Test connection if URL is set
      if (url) {
        const result = await testBackendConnection()
        setConfig((prev) => ({
          ...prev,
          isConnected: result.success,
          connectionError: result.error || null,
          isLoading: false,
        }))
        return result
      }

      // Empty URL = same-origin, always "connected"
      setConfig((prev) => ({
        ...prev,
        isConnected: true,
        connectionError: null,
        isLoading: false,
      }))
      return { success: true }
    },
    []
  )

  const testConnection = useCallback(async (): Promise<{
    success: boolean
    error?: string
  }> => {
    setConfig((prev) => ({ ...prev, isLoading: true }))
    const result = await testBackendConnection()
    setConfig((prev) => ({
      ...prev,
      isConnected: result.success,
      connectionError: result.error || null,
      isLoading: false,
    }))
    return result
  }, [])

  const clearConfig = useCallback(() => {
    setStoredApiBaseUrl('')
    setConfig({
      baseUrl: '',
      isConfigured: false,
      isConnected: true,
      connectionError: null,
      isLoading: false,
    })
  }, [])

  return (
    <ApiConfigContext.Provider
      value={{ config, setBaseUrl, testConnection, clearConfig }}
    >
      {children}
    </ApiConfigContext.Provider>
  )
}

export function useApiConfig(): ApiConfigContextValue {
  const context = useContext(ApiConfigContext)
  if (!context) {
    throw new Error('useApiConfig must be used within an ApiConfigProvider')
  }
  return context
}
