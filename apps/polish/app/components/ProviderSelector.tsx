'use client'

import { useProviders, PROVIDER_TYPE_LABELS } from '@/app/context/ProviderContext'

interface ProviderSelectorProps {
  value: string | null  // provider ID or null for default
  onChange: (providerId: string | null) => void
  disabled?: boolean
  className?: string
}

export function ProviderSelector({ value, onChange, disabled, className }: ProviderSelectorProps) {
  const { providers, defaultProvider, hasProviders, isLoading } = useProviders()

  if (isLoading) {
    return (
      <div className={`flex items-center gap-2 text-gray-600 text-sm ${className}`}>
        <span className="animate-spin">◌</span>
        Loading providers...
      </div>
    )
  }

  if (!hasProviders) {
    return (
      <div className={`text-yellow-500 text-xs ${className}`}>
        No providers configured. Using environment variables.
      </div>
    )
  }

  return (
    <select
      value={value || ''}
      onChange={(e) => onChange(e.target.value || null)}
      disabled={disabled}
      className={`
        bg-black border border-green-900/50 rounded px-3 py-2
        text-green-300 text-sm
        focus:outline-none focus:border-green-500/50
        disabled:opacity-50 disabled:cursor-not-allowed
        ${className}
      `}
    >
      <option value="">
        Use default ({defaultProvider?.name || 'None'})
      </option>
      {providers.map(provider => (
        <option key={provider.id} value={provider.id}>
          {provider.name} ({PROVIDER_TYPE_LABELS[provider.type]})
        </option>
      ))}
    </select>
  )
}

// Compact version for inline use
export function ProviderSelectorCompact({ value, onChange, disabled }: ProviderSelectorProps) {
  const { providers, defaultProvider, hasProviders, isLoading } = useProviders()

  if (isLoading || !hasProviders) {
    return null
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] text-gray-600 uppercase tracking-widest">Provider:</span>
      <select
        value={value || ''}
        onChange={(e) => onChange(e.target.value || null)}
        disabled={disabled}
        className="
          bg-transparent border-none
          text-green-400 text-xs
          focus:outline-none
          disabled:opacity-50 disabled:cursor-not-allowed
          cursor-pointer
        "
      >
        <option value="">Default ({defaultProvider?.name?.slice(0, 15) || 'None'})</option>
        {providers.map(provider => (
          <option key={provider.id} value={provider.id}>
            {provider.name}
          </option>
        ))}
      </select>
    </div>
  )
}
