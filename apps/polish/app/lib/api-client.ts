/**
 * Centralized API client for Polish
 * Handles backend URL configuration and cross-origin requests
 */

const STORAGE_KEY = 'polish_api_base_url'

/**
 * Get the configured API base URL from localStorage
 * Returns empty string if not configured (use same-origin)
 */
export function getApiBaseUrl(): string {
  if (typeof window === 'undefined') return ''
  return localStorage.getItem(STORAGE_KEY) || ''
}

/**
 * Set the API base URL in localStorage
 * @param url - The backend URL (e.g., 'http://localhost:3000') or empty string for same-origin
 */
export function setApiBaseUrl(url: string): void {
  if (typeof window === 'undefined') return
  // Normalize: remove trailing slash
  const normalized = url.replace(/\/$/, '')
  if (normalized) {
    localStorage.setItem(STORAGE_KEY, normalized)
  } else {
    localStorage.removeItem(STORAGE_KEY)
  }
}

/**
 * Validate that a URL is a valid API base URL
 */
export function isValidApiUrl(url: string): boolean {
  if (!url) return true // Empty is valid (same-origin)
  try {
    const parsed = new URL(url)
    return ['http:', 'https:'].includes(parsed.protocol)
  } catch {
    return false
  }
}

/**
 * Build a full API URL from a path
 * @param path - The API path (e.g., '/api/sessions')
 */
export function buildApiUrl(path: string): string {
  const baseUrl = getApiBaseUrl()
  // If no base URL configured, use relative path
  if (!baseUrl) return path
  // Ensure path starts with /
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  return `${baseUrl}${normalizedPath}`
}

/**
 * Fetch wrapper that handles cross-origin requests
 * Automatically adds credentials for CORS when a custom backend is configured
 */
export async function apiFetch(
  path: string,
  options: RequestInit = {}
): Promise<Response> {
  const url = buildApiUrl(path)
  const baseUrl = getApiBaseUrl()

  // Add CORS credentials for cross-origin requests
  if (baseUrl) {
    options.credentials = 'include'
  }

  return fetch(url, options)
}

/**
 * Create an EventSource for SSE streams
 * Uses polyfill for cross-origin support with credentials
 */
export function createApiEventSource(path: string): EventSource {
  const url = buildApiUrl(path)
  const baseUrl = getApiBaseUrl()

  // For cross-origin, we need withCredentials support
  // The native EventSource doesn't support this in all browsers
  if (baseUrl) {
    // For cross-origin SSE, create with withCredentials
    // Use dynamic import but since we need sync return, use require pattern
    // The EventSourcePolyfill from event-source-polyfill supports withCredentials
    const { EventSourcePolyfill } =
      // @ts-expect-error - dynamic require for polyfill
      typeof window !== 'undefined' ? window.__eventSourcePolyfill || (window.__eventSourcePolyfill = require('event-source-polyfill')) : { EventSourcePolyfill: EventSource }
    return new EventSourcePolyfill(url, {
      withCredentials: true,
    }) as EventSource
  }

  // Same-origin: use native EventSource
  return new EventSource(url)
}

/**
 * Test connection to the configured backend (reads from localStorage)
 * @returns Object with success status and optional error message
 */
export async function testBackendConnection(): Promise<{
  success: boolean
  error?: string
}> {
  return testUrlConnection(getApiBaseUrl())
}

/**
 * Test connection to a specific URL (doesn't use localStorage)
 * @param baseUrl - The backend URL to test, or empty string for same-origin
 * @returns Object with success status and optional error message
 */
export async function testUrlConnection(baseUrl: string): Promise<{
  success: boolean
  error?: string
}> {
  const normalizedBase = baseUrl ? baseUrl.replace(/\/$/, '') : ''
  const url = normalizedBase ? `${normalizedBase}/api/sessions` : '/api/sessions'

  try {
    const response = await fetch(url, {
      credentials: normalizedBase ? 'include' : 'same-origin',
    })
    if (response.ok) {
      return { success: true }
    }
    return { success: false, error: `Server returned ${response.status}` }
  } catch (error) {
    if (error instanceof TypeError) {
      // Network error - likely CORS or connection refused
      if (error.message.includes('Failed to fetch')) {
        return {
          success: false,
          error: 'Connection failed. Check if the backend is running and CORS is configured.',
        }
      }
    }
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Connection failed',
    }
  }
}
