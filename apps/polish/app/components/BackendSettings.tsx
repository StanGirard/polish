'use client'

import { useState, useEffect } from 'react'
import { useApiConfig } from '@/app/context/ApiConfigContext'
import { isValidApiUrl } from '@/app/lib/api-client'

interface BackendSettingsProps {
  isOpen: boolean
  onClose: () => void
}

export function BackendSettings({ isOpen, onClose }: BackendSettingsProps) {
  const { config, setBaseUrl, testConnection, clearConfig } = useApiConfig()
  const [inputUrl, setInputUrl] = useState('')
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // Sync input with config when opening
  useEffect(() => {
    if (isOpen) {
      setInputUrl(config.baseUrl)
      setTestStatus('idle')
      setErrorMessage(null)
    }
  }, [isOpen, config.baseUrl])

  if (!isOpen) return null

  const handleTest = async () => {
    if (inputUrl && !isValidApiUrl(inputUrl)) {
      setTestStatus('error')
      setErrorMessage('Invalid URL format. Use http:// or https://')
      return
    }

    setTestStatus('testing')
    setErrorMessage(null)

    // Temporarily set the URL to test it
    const originalUrl = config.baseUrl
    await setBaseUrl(inputUrl)
    const result = await testConnection()

    if (result.success) {
      setTestStatus('success')
    } else {
      setTestStatus('error')
      setErrorMessage(result.error || 'Connection failed')
      // Restore original URL on failure
      await setBaseUrl(originalUrl)
    }
  }

  const handleSave = async () => {
    if (inputUrl && !isValidApiUrl(inputUrl)) {
      setErrorMessage('Invalid URL format. Use http:// or https://')
      return
    }

    const result = await setBaseUrl(inputUrl)
    if (result.success) {
      onClose()
    } else {
      setErrorMessage(result.error || 'Failed to save')
    }
  }

  const handleReset = () => {
    clearConfig()
    setInputUrl('')
    setTestStatus('idle')
    setErrorMessage(null)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-black border border-green-500/50 rounded-lg max-w-md w-full mx-4 shadow-2xl box-glow">
        {/* Header */}
        <div className="border-b border-green-900/50 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-green-400">◆</span>
              <h2 className="text-green-400 text-sm uppercase tracking-widest font-bold">
                Backend Configuration
              </h2>
            </div>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-300 text-xl leading-none"
            >
              ×
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="px-6 py-5 space-y-5">
          {/* URL Input */}
          <div>
            <label className="block text-[10px] text-green-700 uppercase tracking-widest mb-2">
              Backend URL
            </label>
            <input
              type="text"
              value={inputUrl}
              onChange={(e) => {
                setInputUrl(e.target.value)
                setTestStatus('idle')
                setErrorMessage(null)
              }}
              placeholder="http://localhost:3000"
              className="w-full bg-black border border-green-900/50 rounded px-4 py-3 text-green-300 placeholder-gray-700 focus:outline-none focus:border-green-500/50 font-mono text-sm"
            />
          </div>

          {/* Status */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-gray-600 uppercase tracking-widest">
              Status:
            </span>
            {testStatus === 'testing' ? (
              <span className="text-purple-400 text-sm flex items-center gap-2">
                <span className="animate-spin">◌</span> Testing...
              </span>
            ) : testStatus === 'success' ? (
              <span className="text-green-400 text-sm flex items-center gap-1">
                <span>●</span> Connected
              </span>
            ) : testStatus === 'error' ? (
              <span className="text-red-400 text-sm flex items-center gap-1">
                <span>●</span> Failed
              </span>
            ) : config.isConfigured ? (
              config.isConnected ? (
                <span className="text-green-400 text-sm flex items-center gap-1">
                  <span>●</span> Connected (Local)
                </span>
              ) : (
                <span className="text-yellow-400 text-sm flex items-center gap-1">
                  <span>●</span> Disconnected
                </span>
              )
            ) : (
              <span className="text-gray-500 text-sm flex items-center gap-1">
                <span>●</span> Using polish.run
              </span>
            )}
          </div>

          {/* Error Message */}
          {errorMessage && (
            <div className="text-red-400 text-xs bg-red-900/20 border border-red-900/30 rounded px-3 py-2">
              {errorMessage}
            </div>
          )}

          {/* Buttons */}
          <div className="flex gap-3">
            <button
              onClick={handleTest}
              disabled={testStatus === 'testing'}
              className="flex-1 px-4 py-2 border border-purple-500/50 text-purple-400 rounded hover:bg-purple-900/20 disabled:opacity-50 disabled:cursor-not-allowed text-sm uppercase tracking-wider"
            >
              Test
            </button>
            <button
              onClick={handleSave}
              disabled={config.isLoading}
              className="flex-1 px-4 py-2 bg-green-600/30 border border-green-500 text-green-300 rounded hover:bg-green-600/50 disabled:opacity-50 disabled:cursor-not-allowed text-sm uppercase tracking-wider"
            >
              Save
            </button>
            <button
              onClick={handleReset}
              className="px-4 py-2 border border-gray-700 text-gray-500 rounded hover:bg-gray-900/50 hover:text-gray-400 text-sm uppercase tracking-wider"
            >
              Reset
            </button>
          </div>

          {/* Help Text */}
          <div className="border-t border-green-900/30 pt-4">
            <p className="text-[10px] text-gray-600 leading-relaxed">
              Leave empty to use the polish.run backend. Enter a URL to connect
              to your local Polish server (e.g., http://localhost:3000).
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * Small indicator component to show in the header
 */
export function BackendIndicator({ onClick }: { onClick: () => void }) {
  const { config } = useApiConfig()

  return (
    <button
      onClick={onClick}
      className={`
        flex items-center gap-1.5 px-2 py-1 rounded text-[10px] uppercase tracking-widest
        border transition-colors
        ${
          config.isConfigured
            ? config.isConnected
              ? 'border-cyan-500/30 text-cyan-400 hover:bg-cyan-900/20'
              : 'border-yellow-500/30 text-yellow-400 hover:bg-yellow-900/20'
            : 'border-gray-700 text-gray-600 hover:bg-gray-900/30 hover:text-gray-500'
        }
      `}
      title={config.isConfigured ? `Backend: ${config.baseUrl}` : 'Using polish.run backend'}
    >
      <span
        className={
          config.isConfigured
            ? config.isConnected
              ? 'text-cyan-400'
              : 'text-yellow-400 blink'
            : 'text-gray-600'
        }
      >
        ●
      </span>
      {config.isConfigured ? 'LOCAL' : 'CLOUD'}
    </button>
  )
}
