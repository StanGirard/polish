'use client'

import { useState, useEffect } from 'react'
import {
  useProviders,
  PROVIDER_TYPE_LABELS,
  PROVIDER_BASE_URLS,
  PROVIDER_DEFAULT_MODELS,
  PROVIDER_MODEL_OPTIONS,
  type ProviderType,
  type ProviderMasked,
  type CreateProviderRequest
} from '@/app/context/ProviderContext'

interface ProviderManagerProps {
  isOpen: boolean
  onClose: () => void
}

type ViewMode = 'list' | 'add' | 'edit'

const PROVIDER_TYPES: ProviderType[] = [
  'anthropic',
  'anthropic_oauth',
  'openrouter',
  'glm',
  'openai_compatible'
]

export function ProviderManager({ isOpen, onClose }: ProviderManagerProps) {
  const {
    providers,
    isLoading,
    error,
    createProvider,
    updateProvider,
    deleteProvider,
    testProvider,
    setDefaultProvider
  } = useProviders()

  const [viewMode, setViewMode] = useState<ViewMode>('list')
  const [editingProvider, setEditingProvider] = useState<ProviderMasked | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [testStatus, setTestStatus] = useState<Record<string, 'idle' | 'testing' | 'success' | 'error'>>({})
  const [testErrors, setTestErrors] = useState<Record<string, string>>({})

  // Form state
  const [formData, setFormData] = useState<{
    name: string
    type: ProviderType
    baseUrl: string
    apiKey: string
    model: string
    isDefault: boolean
  }>({
    name: '',
    type: 'anthropic',
    baseUrl: '',
    apiKey: '',
    model: PROVIDER_DEFAULT_MODELS['anthropic'],
    isDefault: false
  })

  // Reset form when opening
  useEffect(() => {
    if (isOpen) {
      setViewMode('list')
      setEditingProvider(null)
      setFormError(null)
      resetForm()
    }
  }, [isOpen])

  const resetForm = () => {
    setFormData({
      name: '',
      type: 'anthropic',
      baseUrl: '',
      apiKey: '',
      model: PROVIDER_DEFAULT_MODELS['anthropic'],
      isDefault: false
    })
    setFormError(null)
  }

  const handleTypeChange = (type: ProviderType) => {
    setFormData(prev => ({
      ...prev,
      type,
      baseUrl: PROVIDER_BASE_URLS[type] || '',
      model: PROVIDER_DEFAULT_MODELS[type]
    }))
  }

  const handleAddNew = () => {
    resetForm()
    setViewMode('add')
  }

  const handleEdit = (provider: ProviderMasked) => {
    setEditingProvider(provider)
    setFormData({
      name: provider.name,
      type: provider.type,
      baseUrl: provider.baseUrl || PROVIDER_BASE_URLS[provider.type] || '',
      apiKey: '', // Don't show existing key
      model: provider.model || PROVIDER_DEFAULT_MODELS[provider.type],
      isDefault: provider.isDefault
    })
    setViewMode('edit')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError(null)

    try {
      if (viewMode === 'add') {
        await createProvider({
          name: formData.name,
          type: formData.type,
          baseUrl: formData.baseUrl || undefined,
          apiKey: formData.apiKey,
          model: formData.model || undefined,
          isDefault: formData.isDefault
        })
      } else if (viewMode === 'edit' && editingProvider) {
        await updateProvider(editingProvider.id, {
          name: formData.name,
          baseUrl: formData.baseUrl || undefined,
          apiKey: formData.apiKey || undefined, // Only update if provided
          model: formData.model || undefined,
          isDefault: formData.isDefault
        })
      }

      setViewMode('list')
      resetForm()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Operation failed')
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this provider?')) return

    try {
      await deleteProvider(id)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete provider')
    }
  }

  const handleTest = async (id: string) => {
    setTestStatus(prev => ({ ...prev, [id]: 'testing' }))
    setTestErrors(prev => ({ ...prev, [id]: '' }))

    try {
      const result = await testProvider(id)
      setTestStatus(prev => ({ ...prev, [id]: result.success ? 'success' : 'error' }))
      if (!result.success && result.error) {
        setTestErrors(prev => ({ ...prev, [id]: result.error! }))
      }
    } catch (err) {
      setTestStatus(prev => ({ ...prev, [id]: 'error' }))
      setTestErrors(prev => ({ ...prev, [id]: err instanceof Error ? err.message : 'Test failed' }))
    }
  }

  const handleSetDefault = async (id: string) => {
    try {
      await setDefaultProvider(id)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to set default provider')
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-black border border-green-500/50 rounded-lg max-w-2xl w-full mx-4 shadow-2xl box-glow max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="border-b border-green-900/50 px-6 py-4 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-green-400">◆</span>
              <h2 className="text-green-400 text-sm uppercase tracking-widest font-bold">
                {viewMode === 'list' ? 'AI Providers' : viewMode === 'add' ? 'Add Provider' : 'Edit Provider'}
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
        <div className="px-6 py-5 overflow-y-auto flex-1">
          {viewMode === 'list' ? (
            <ProviderList
              providers={providers}
              isLoading={isLoading}
              error={error}
              testStatus={testStatus}
              testErrors={testErrors}
              onAddNew={handleAddNew}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onTest={handleTest}
              onSetDefault={handleSetDefault}
            />
          ) : (
            <ProviderForm
              formData={formData}
              setFormData={setFormData}
              formError={formError}
              isEdit={viewMode === 'edit'}
              onTypeChange={handleTypeChange}
              onSubmit={handleSubmit}
              onCancel={() => {
                setViewMode('list')
                resetForm()
              }}
            />
          )}
        </div>
      </div>
    </div>
  )
}

// ============================================================================
// Provider List
// ============================================================================

interface ProviderListProps {
  providers: ProviderMasked[]
  isLoading: boolean
  error: string | null
  testStatus: Record<string, 'idle' | 'testing' | 'success' | 'error'>
  testErrors: Record<string, string>
  onAddNew: () => void
  onEdit: (provider: ProviderMasked) => void
  onDelete: (id: string) => void
  onTest: (id: string) => void
  onSetDefault: (id: string) => void
}

function ProviderList({
  providers,
  isLoading,
  error,
  testStatus,
  testErrors,
  onAddNew,
  onEdit,
  onDelete,
  onTest,
  onSetDefault
}: ProviderListProps) {
  if (isLoading) {
    return (
      <div className="text-center py-8">
        <span className="text-purple-400 animate-spin">◌</span>
        <span className="text-gray-500 ml-2">Loading providers...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-red-400 text-sm bg-red-900/20 border border-red-900/30 rounded px-3 py-2">
        {error}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Add button */}
      <button
        onClick={onAddNew}
        className="w-full px-4 py-3 border border-dashed border-green-700/50 rounded text-green-500 hover:bg-green-900/20 hover:border-green-500/50 transition-colors text-sm"
      >
        + Add New Provider
      </button>

      {/* Provider list */}
      {providers.length === 0 ? (
        <div className="text-center py-8 text-gray-600">
          <p className="mb-2">No providers configured</p>
          <p className="text-xs">Add a provider to start using Polish with your AI account</p>
        </div>
      ) : (
        <div className="space-y-3">
          {providers.map(provider => (
            <div
              key={provider.id}
              className={`border rounded p-4 ${
                provider.isDefault
                  ? 'border-green-500/50 bg-green-900/10'
                  : 'border-gray-800 bg-gray-900/30'
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-green-300 font-medium truncate">{provider.name}</span>
                    {provider.isDefault && (
                      <span className="text-[9px] px-1.5 py-0.5 bg-green-600/30 text-green-400 rounded uppercase tracking-wider">
                        Default
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <span className="px-1.5 py-0.5 bg-gray-800 rounded">
                      {PROVIDER_TYPE_LABELS[provider.type]}
                    </span>
                    {provider.model && (
                      <span className="px-1.5 py-0.5 bg-purple-900/30 text-purple-400 rounded text-[10px]">
                        {provider.model}
                      </span>
                    )}
                    <span className="font-mono">{provider.apiKeyMasked}</span>
                  </div>
                  {provider.baseUrl && (
                    <div className="text-[10px] text-gray-600 mt-1 truncate">
                      {provider.baseUrl}
                    </div>
                  )}
                  {testErrors[provider.id] && (
                    <div className="text-xs text-red-400 mt-2">
                      {testErrors[provider.id]}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  {/* Test status indicator */}
                  {testStatus[provider.id] === 'testing' && (
                    <span className="text-purple-400 animate-spin">◌</span>
                  )}
                  {testStatus[provider.id] === 'success' && (
                    <span className="text-green-400">●</span>
                  )}
                  {testStatus[provider.id] === 'error' && (
                    <span className="text-red-400">●</span>
                  )}

                  {/* Action buttons */}
                  <button
                    onClick={() => onTest(provider.id)}
                    disabled={testStatus[provider.id] === 'testing'}
                    className="px-2 py-1 text-[10px] border border-purple-700/50 text-purple-400 rounded hover:bg-purple-900/20 disabled:opacity-50 uppercase tracking-wider"
                  >
                    Test
                  </button>
                  <button
                    onClick={() => onEdit(provider)}
                    className="px-2 py-1 text-[10px] border border-gray-700 text-gray-400 rounded hover:bg-gray-800 uppercase tracking-wider"
                  >
                    Edit
                  </button>
                  {!provider.isDefault && (
                    <button
                      onClick={() => onSetDefault(provider.id)}
                      className="px-2 py-1 text-[10px] border border-green-700/50 text-green-500 rounded hover:bg-green-900/20 uppercase tracking-wider"
                    >
                      Set Default
                    </button>
                  )}
                  <button
                    onClick={() => onDelete(provider.id)}
                    className="px-2 py-1 text-[10px] border border-red-900/50 text-red-500 rounded hover:bg-red-900/20 uppercase tracking-wider"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Help text */}
      <div className="border-t border-green-900/30 pt-4 mt-4">
        <p className="text-[10px] text-gray-600 leading-relaxed">
          Configure AI providers to use with Polish. You can add multiple providers
          and select which one to use for each session. The default provider will be
          used when no specific provider is selected.
        </p>
      </div>
    </div>
  )
}

// ============================================================================
// Provider Form
// ============================================================================

interface ProviderFormProps {
  formData: {
    name: string
    type: ProviderType
    baseUrl: string
    apiKey: string
    model: string
    isDefault: boolean
  }
  setFormData: React.Dispatch<React.SetStateAction<{
    name: string
    type: ProviderType
    baseUrl: string
    apiKey: string
    model: string
    isDefault: boolean
  }>>
  formError: string | null
  isEdit: boolean
  onTypeChange: (type: ProviderType) => void
  onSubmit: (e: React.FormEvent) => void
  onCancel: () => void
}

function ProviderForm({
  formData,
  setFormData,
  formError,
  isEdit,
  onTypeChange,
  onSubmit,
  onCancel
}: ProviderFormProps) {
  const requiresBaseUrl = formData.type === 'openai_compatible'

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {/* Name */}
      <div>
        <label className="block text-[10px] text-green-700 uppercase tracking-widest mb-2">
          Name
        </label>
        <input
          type="text"
          value={formData.name}
          onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
          placeholder="My OpenRouter Account"
          required
          className="w-full bg-black border border-green-900/50 rounded px-4 py-3 text-green-300 placeholder-gray-700 focus:outline-none focus:border-green-500/50 font-mono text-sm"
        />
      </div>

      {/* Type */}
      {!isEdit && (
        <div>
          <label className="block text-[10px] text-green-700 uppercase tracking-widest mb-2">
            Provider Type
          </label>
          <div className="grid grid-cols-2 gap-2">
            {PROVIDER_TYPES.map(type => (
              <button
                key={type}
                type="button"
                onClick={() => onTypeChange(type)}
                className={`px-3 py-2 text-xs border rounded transition-colors ${
                  formData.type === type
                    ? 'border-green-500 bg-green-900/30 text-green-300'
                    : 'border-gray-800 text-gray-500 hover:border-gray-700'
                }`}
              >
                {PROVIDER_TYPE_LABELS[type]}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Base URL */}
      <div>
        <label className="block text-[10px] text-green-700 uppercase tracking-widest mb-2">
          Base URL {!requiresBaseUrl && <span className="text-gray-600">(Optional)</span>}
        </label>
        <input
          type="text"
          value={formData.baseUrl}
          onChange={e => setFormData(prev => ({ ...prev, baseUrl: e.target.value }))}
          placeholder={PROVIDER_BASE_URLS[formData.type] || 'https://api.example.com/v1'}
          required={requiresBaseUrl}
          className="w-full bg-black border border-green-900/50 rounded px-4 py-3 text-green-300 placeholder-gray-700 focus:outline-none focus:border-green-500/50 font-mono text-sm"
        />
        <p className="text-[10px] text-gray-600 mt-1">
          {requiresBaseUrl
            ? 'Required for OpenAI-compatible providers'
            : `Default: ${PROVIDER_BASE_URLS[formData.type] || 'None'}`}
        </p>
      </div>

      {/* API Key */}
      <div>
        <label className="block text-[10px] text-green-700 uppercase tracking-widest mb-2">
          API Key {isEdit && <span className="text-gray-600">(Leave empty to keep current)</span>}
        </label>
        <input
          type="password"
          value={formData.apiKey}
          onChange={e => setFormData(prev => ({ ...prev, apiKey: e.target.value }))}
          placeholder={isEdit ? '••••••••' : 'sk-...'}
          required={!isEdit}
          className="w-full bg-black border border-green-900/50 rounded px-4 py-3 text-green-300 placeholder-gray-700 focus:outline-none focus:border-green-500/50 font-mono text-sm"
        />
      </div>

      {/* Model */}
      <div>
        <label className="block text-[10px] text-green-700 uppercase tracking-widest mb-2">
          Model
        </label>
        <div className="flex gap-2">
          <select
            value={formData.model}
            onChange={e => setFormData(prev => ({ ...prev, model: e.target.value }))}
            className="flex-1 bg-black border border-green-900/50 rounded px-4 py-3 text-green-300 focus:outline-none focus:border-green-500/50 font-mono text-sm"
          >
            {PROVIDER_MODEL_OPTIONS[formData.type].map(model => (
              <option key={model} value={model}>
                {model}
              </option>
            ))}
          </select>
          <input
            type="text"
            value={formData.model}
            onChange={e => setFormData(prev => ({ ...prev, model: e.target.value }))}
            placeholder="Or enter custom model..."
            className="flex-1 bg-black border border-green-900/50 rounded px-4 py-3 text-green-300 placeholder-gray-700 focus:outline-none focus:border-green-500/50 font-mono text-sm"
          />
        </div>
        <p className="text-[10px] text-gray-600 mt-1">
          Select from suggested models or enter a custom model name
        </p>
      </div>

      {/* Default checkbox */}
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="isDefault"
          checked={formData.isDefault}
          onChange={e => setFormData(prev => ({ ...prev, isDefault: e.target.checked }))}
          className="w-4 h-4 accent-green-500"
        />
        <label htmlFor="isDefault" className="text-sm text-gray-400">
          Set as default provider
        </label>
      </div>

      {/* Error */}
      {formError && (
        <div className="text-red-400 text-xs bg-red-900/20 border border-red-900/30 rounded px-3 py-2">
          {formError}
        </div>
      )}

      {/* Buttons */}
      <div className="flex gap-3 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 px-4 py-2 border border-gray-700 text-gray-500 rounded hover:bg-gray-900/50 hover:text-gray-400 text-sm uppercase tracking-wider"
        >
          Cancel
        </button>
        <button
          type="submit"
          className="flex-1 px-4 py-2 bg-green-600/30 border border-green-500 text-green-300 rounded hover:bg-green-600/50 text-sm uppercase tracking-wider"
        >
          {isEdit ? 'Save Changes' : 'Add Provider'}
        </button>
      </div>
    </form>
  )
}

// ============================================================================
// Header Indicator
// ============================================================================

export function ProviderIndicator({ onClick }: { onClick: () => void }) {
  const { hasProviders, defaultProvider, isLoading } = useProviders()

  if (isLoading) {
    return (
      <button
        onClick={onClick}
        className="flex items-center gap-1.5 px-2 py-1 rounded text-[10px] uppercase tracking-widest border border-gray-700 text-gray-600"
      >
        <span className="animate-spin">◌</span>
        Loading
      </button>
    )
  }

  return (
    <button
      onClick={onClick}
      className={`
        flex items-center gap-1.5 px-2 py-1 rounded text-[10px] uppercase tracking-widest
        border transition-colors
        ${
          hasProviders
            ? 'border-green-500/30 text-green-400 hover:bg-green-900/20'
            : 'border-yellow-500/30 text-yellow-400 hover:bg-yellow-900/20'
        }
      `}
      title={hasProviders ? `Provider: ${defaultProvider?.name || 'None'}` : 'No providers configured'}
    >
      <span className={hasProviders ? 'text-green-400' : 'text-yellow-400 blink'}>
        ●
      </span>
      {hasProviders ? (defaultProvider?.name?.slice(0, 12) || 'Provider') : 'No Provider'}
    </button>
  )
}
