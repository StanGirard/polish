'use client'

import { useState, useEffect, useCallback } from 'react'
import { CapabilitiesSelector } from './CapabilitiesSelector'
import { ProviderSelector } from './ProviderSelector'
import { useProviders } from '@/app/context/ProviderContext'
import { apiFetch } from '@/app/lib/api-client'
import type { CapabilityOverride } from '@/lib/types'

interface CapabilitiesConfig {
  tools: string[]
  mcpServers: string[]
  plugins: Array<{ type: string; id: string }>
  agents: string[]
}

// Mission templates for quick selection
const MISSION_TEMPLATES = [
  { label: 'Fix Bug', mission: 'Fix the bug reported in the issue' },
  { label: 'Add Feature', mission: 'Implement the new feature as described' },
  { label: 'Refactor', mission: 'Refactor the code to improve readability and maintainability' },
  { label: 'Optimize', mission: 'Optimize the code for better performance' },
  { label: 'Add Tests', mission: 'Add comprehensive tests for the existing code' },
  { label: 'Update Docs', mission: 'Update documentation to reflect recent changes' },
  { label: 'Security', mission: 'Review and fix security vulnerabilities' },
]

const MISSION_HISTORY_KEY = 'polish-mission-history'
const MAX_HISTORY_ITEMS = 5

interface NewSessionFormProps {
  onCreateSession: (mission?: string, extendedThinking?: boolean, capabilityOverrides?: CapabilityOverride[], enablePlanning?: boolean, providerId?: string) => void
  disabled?: boolean
}

// Helper functions for mission history
function loadMissionHistory(): string[] {
  if (typeof window === 'undefined') return []
  try {
    const stored = localStorage.getItem(MISSION_HISTORY_KEY)
    return stored ? JSON.parse(stored) : []
  } catch {
    return []
  }
}

function saveMissionToHistory(mission: string): void {
  if (typeof window === 'undefined' || !mission.trim()) return
  const history = loadMissionHistory()
  const filtered = history.filter(m => m !== mission)
  const updated = [mission, ...filtered].slice(0, MAX_HISTORY_ITEMS)
  localStorage.setItem(MISSION_HISTORY_KEY, JSON.stringify(updated))
}

export function NewSessionForm({ onCreateSession, disabled }: NewSessionFormProps) {
  const [mission, setMission] = useState('')
  const [isExpanded, setIsExpanded] = useState(false)
  const [extendedThinking, setExtendedThinking] = useState(true)
  const [enablePlanning, setEnablePlanning] = useState(false)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [capabilities, setCapabilities] = useState<CapabilitiesConfig | null>(null)
  const [capabilityOverrides, setCapabilityOverrides] = useState<CapabilityOverride[]>([])
  const [selectedProviderId, setSelectedProviderId] = useState<string | null>(null)
  const [missionHistory, setMissionHistory] = useState<string[]>([])
  const [showTemplates, setShowTemplates] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const { hasProviders } = useProviders()

  // Load mission history on mount
  useEffect(() => {
    setMissionHistory(loadMissionHistory())
  }, [])

  // Fetch capabilities when expanded
  useEffect(() => {
    if (isExpanded && !capabilities) {
      apiFetch('/api/capabilities')
        .then(res => res.json())
        .then(data => setCapabilities(data))
        .catch(err => console.error('Failed to load capabilities:', err))
    }
  }, [isExpanded, capabilities])

  const handleSubmit = useCallback(async () => {
    if (isSubmitting) return

    // Basic validation
    const trimmedMission = mission.trim()
    if (!trimmedMission && !enablePlanning) {
      setErrorMessage('Please enter a mission or enable polish-only mode')
      setTimeout(() => setErrorMessage(null), 3000)
      return
    }

    setIsSubmitting(true)
    setErrorMessage(null)

    try {
      const overrides = capabilityOverrides.length > 0 ? capabilityOverrides : undefined
      await onCreateSession(trimmedMission || undefined, extendedThinking, overrides, enablePlanning, selectedProviderId || undefined)

      // Save to history if we have a mission
      if (trimmedMission) {
        saveMissionToHistory(trimmedMission)
        setMissionHistory(loadMissionHistory())
      }

      // Reset form
      setMission('')
      setIsExpanded(false)
      setShowAdvanced(false)
      setShowTemplates(false)
      setCapabilityOverrides([])
      setEnablePlanning(false)
      setSelectedProviderId(null)
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to create session')
      setTimeout(() => setErrorMessage(null), 3000)
    } finally {
      setIsSubmitting(false)
    }
  }, [mission, extendedThinking, capabilityOverrides, enablePlanning, selectedProviderId, isSubmitting, onCreateSession])

  const handleSelectTemplate = (templateMission: string) => {
    setMission(templateMission)
    setShowTemplates(false)
  }

  const handleSelectHistory = (historyMission: string) => {
    setMission(historyMission)
  }

  return (
    <div className="relative">
      {!isExpanded ? (
        <button
          onClick={() => setIsExpanded(true)}
          disabled={disabled}
          className="
            w-full px-6 py-4 rounded border border-dashed border-green-800
            bg-black/30 hover:bg-green-900/20 hover:border-green-600
            text-green-600 hover:text-green-400
            transition-all group
            disabled:opacity-50 disabled:cursor-not-allowed
          "
        >
          <div className="flex items-center justify-center gap-3">
            <span className="text-2xl group-hover:animate-pulse">+</span>
            <span className="text-sm font-bold uppercase tracking-widest">New Session</span>
          </div>
          <div className="text-[10px] text-gray-700 tracking-widest mt-1">
            CLICK TO LAUNCH NEW POLISH TASK
          </div>
        </button>
      ) : (
        <div className="p-5 rounded border border-green-500/30 bg-black/50 box-glow data-stream">
          {/* Top gradient line */}
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-green-400 to-transparent" />

          <label className="text-green-400 text-xs block mb-3 uppercase tracking-widest flex items-center gap-2">
            <span>▶</span> New Session
            <span className="text-gray-800">|</span>
            <span className="text-gray-700 text-[9px]">MISSION PARAMETERS</span>
          </label>

          <div className="relative">
            <textarea
              value={mission}
              onChange={(e) => setMission(e.target.value)}
              onKeyDown={(e) => {
                if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                  e.preventDefault()
                  handleSubmit()
                }
              }}
              placeholder=">> Enter mission... (optional, e.g., Add dark mode support)"
              className="
                w-full bg-black/50 border border-green-800/50 rounded p-3
                text-sm text-green-300 placeholder-green-900
                resize-none focus:outline-none focus:border-green-400 focus:box-glow
                font-mono leading-relaxed
              "
              rows={2}
              autoFocus
              disabled={isSubmitting}
            />
            <div className="absolute bottom-2 right-2 text-[9px] text-gray-800 tracking-widest flex items-center gap-2">
              <span className="text-gray-700">Ctrl+Enter to submit</span>
              <span className="text-gray-800">|</span>
              <span>{mission.length} CHARS</span>
            </div>
          </div>

          {/* Error message */}
          {errorMessage && (
            <div className="mt-3 px-3 py-2 bg-red-900/20 border border-red-500/30 rounded text-red-400 text-xs">
              <span className="mr-2">!</span>
              {errorMessage}
            </div>
          )}

          {/* Mission Templates */}
          <div className="mt-4">
            <div className="flex items-center justify-between mb-2">
              <button
                type="button"
                onClick={() => setShowTemplates(!showTemplates)}
                className="flex items-center gap-2 text-xs text-gray-500 hover:text-green-400 transition-colors"
              >
                <span className={`text-[10px] transition-transform ${showTemplates ? 'rotate-90' : ''}`}>▶</span>
                <span className="uppercase tracking-widest">Quick Templates</span>
              </button>
            </div>

            {showTemplates && (
              <div className="grid grid-cols-2 gap-2 p-3 border border-gray-800 rounded bg-black/30">
                {MISSION_TEMPLATES.map((template, index) => (
                  <button
                    key={index}
                    type="button"
                    onClick={() => handleSelectTemplate(template.mission)}
                    disabled={isSubmitting}
                    className="
                      px-3 py-2 text-left text-xs text-gray-400 hover:text-green-300
                      bg-gray-900/50 hover:bg-green-900/20 border border-gray-800
                      hover:border-green-700 rounded transition-all
                      disabled:opacity-50 disabled:cursor-not-allowed
                    "
                  >
                    <div className="font-semibold text-green-500 mb-1">{template.label}</div>
                    <div className="text-[9px] text-gray-600 line-clamp-2">{template.mission}</div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Mission History */}
          {missionHistory.length > 0 && (
            <div className="mt-4">
              <div className="text-[9px] text-gray-700 tracking-widest mb-2">
                RECENT MISSIONS
              </div>
              <div className="space-y-1">
                {missionHistory.map((historyMission, index) => (
                  <button
                    key={index}
                    type="button"
                    onClick={() => handleSelectHistory(historyMission)}
                    disabled={isSubmitting}
                    className="
                      w-full px-3 py-2 text-left text-xs text-gray-500 hover:text-green-300
                      bg-gray-900/30 hover:bg-green-900/10 border border-gray-800/50
                      hover:border-green-800 rounded transition-all truncate
                      disabled:opacity-50 disabled:cursor-not-allowed
                    "
                  >
                    {historyMission}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Extended Thinking Toggle */}
          <div className="mt-4 flex items-center gap-3">
            <button
              type="button"
              onClick={() => setExtendedThinking(!extendedThinking)}
              className={`
                relative w-12 h-6 rounded-full transition-all
                ${extendedThinking
                  ? 'bg-green-600/40 border border-green-400'
                  : 'bg-gray-800/50 border border-gray-700'}
              `}
            >
              <span
                className={`
                  absolute top-0.5 w-5 h-5 rounded-full transition-all
                  ${extendedThinking
                    ? 'left-6 bg-green-400'
                    : 'left-0.5 bg-gray-600'}
                `}
              />
            </button>
            <span className={`text-xs uppercase tracking-widest ${extendedThinking ? 'text-green-400' : 'text-gray-600'}`}>
              Extended Thinking {extendedThinking ? 'ON' : 'OFF'}
            </span>
            <span className="text-[9px] text-gray-700 tracking-widest">
              (ULTRATHINK MODE)
            </span>
          </div>

          {/* Planning Mode Toggle - only visible when mission is provided */}
          {mission.trim() && (
            <div className="mt-4 flex items-center gap-3">
              <button
                type="button"
                onClick={() => setEnablePlanning(!enablePlanning)}
                className={`
                  relative w-12 h-6 rounded-full transition-all
                  ${enablePlanning
                    ? 'bg-orange-600/40 border border-orange-400'
                    : 'bg-gray-800/50 border border-gray-700'}
                `}
              >
                <span
                  className={`
                    absolute top-0.5 w-5 h-5 rounded-full transition-all
                    ${enablePlanning
                      ? 'left-6 bg-orange-400'
                      : 'left-0.5 bg-gray-600'}
                  `}
                />
              </button>
              <span className={`text-xs uppercase tracking-widest ${enablePlanning ? 'text-orange-400' : 'text-gray-600'}`}>
                Planning Mode {enablePlanning ? 'ON' : 'OFF'}
              </span>
              <span className="text-[9px] text-gray-700 tracking-widest">
                (REVIEW PLAN BEFORE EXECUTION)
              </span>
            </div>
          )}

          {/* Advanced Options Toggle */}
          <div className="mt-4">
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="flex items-center gap-2 text-xs text-gray-500 hover:text-green-400 transition-colors"
            >
              <span className={`text-[10px] transition-transform ${showAdvanced ? 'rotate-90' : ''}`}>▶</span>
              <span className="uppercase tracking-widest">Advanced Options</span>
              {(capabilityOverrides.filter(o => !o.enabled).length > 0 || selectedProviderId) && (
                <span className="text-[9px] px-1.5 py-0.5 bg-amber-900/50 text-amber-400 rounded">
                  {capabilityOverrides.filter(o => !o.enabled).length + (selectedProviderId ? 1 : 0)} modified
                </span>
              )}
            </button>

            {showAdvanced && (
              <div className="mt-3 space-y-4">
                {/* Provider Selection */}
                {hasProviders && (
                  <div className="p-3 border border-gray-800 rounded bg-black/30">
                    <div className="text-[9px] text-gray-600 tracking-widest mb-2">
                      AI PROVIDER
                    </div>
                    <ProviderSelector
                      value={selectedProviderId}
                      onChange={setSelectedProviderId}
                      disabled={disabled}
                      className="w-full"
                    />
                  </div>
                )}

                {/* Capabilities Config */}
                {capabilities && (
                  <div className="p-3 border border-gray-800 rounded bg-black/30">
                    <div className="text-[9px] text-gray-600 tracking-widest mb-3">
                      CAPABILITIES CONFIG | TOGGLE TO ENABLE/DISABLE
                    </div>
                    <CapabilitiesSelector
                      capabilities={capabilities}
                      overrides={capabilityOverrides}
                      onOverridesChange={setCapabilityOverrides}
                    />
                  </div>
                )}

                {!capabilities && (
                  <div className="p-3 border border-gray-800 rounded bg-black/30 text-center">
                    <span className="text-xs text-gray-600 animate-pulse">Loading capabilities...</span>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex gap-3 mt-4">
            <button
              onClick={handleSubmit}
              disabled={disabled || isSubmitting}
              className={`
                flex-1 px-5 py-2.5 rounded font-bold transition-all
                ${enablePlanning
                  ? 'bg-orange-600/20 hover:bg-orange-600/30 border border-orange-400 text-orange-400'
                  : 'bg-green-600/20 hover:bg-green-600/30 border border-green-400 text-green-400'}
                hover:box-glow uppercase text-sm tracking-wider
                flex items-center justify-center gap-2 group
                disabled:opacity-50 disabled:cursor-not-allowed
              `}
            >
              {isSubmitting ? (
                <>
                  <span className="animate-spin">◌</span>
                  <span>Creating...</span>
                </>
              ) : (
                <>
                  <span className="group-hover:animate-pulse">{enablePlanning ? '◆' : '▶'}</span>
                  <span>
                    {enablePlanning
                      ? 'Start Planning'
                      : mission.trim()
                        ? 'Launch with Mission'
                        : 'Launch Polish Only'}
                  </span>
                </>
              )}
            </button>

            <button
              onClick={() => {
                setIsExpanded(false)
                setMission('')
                setShowTemplates(false)
                setErrorMessage(null)
              }}
              disabled={isSubmitting}
              className="
                px-4 py-2.5 rounded font-bold transition-all
                bg-gray-800/50 hover:bg-gray-800 border border-gray-700
                text-gray-500 hover:text-gray-300 uppercase text-sm tracking-wider
                disabled:opacity-50 disabled:cursor-not-allowed
              "
            >
              Cancel
            </button>
          </div>

          <div className="mt-3 text-[9px] text-gray-700 tracking-widest">
            TIP: Leave mission empty for polish-only mode (improve existing code)
          </div>
        </div>
      )}
    </div>
  )
}

export default NewSessionForm
