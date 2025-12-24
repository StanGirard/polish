'use client'

import { useState, useEffect } from 'react'
import { CapabilitiesSelector } from './CapabilitiesSelector'
import { ImageUploader } from './ImageUploader'
import type { CapabilityOverride, ImageAttachment } from '@/lib/types'

interface CapabilitiesConfig {
  tools: string[]
  mcpServers: string[]
  plugins: Array<{ type: string; id: string }>
  agents: string[]
}

interface NewSessionFormProps {
  onCreateSession: (mission?: string, extendedThinking?: boolean, capabilityOverrides?: CapabilityOverride[], missionImages?: ImageAttachment[]) => void
  disabled?: boolean
}

export function NewSessionForm({ onCreateSession, disabled }: NewSessionFormProps) {
  const [mission, setMission] = useState('')
  const [missionImages, setMissionImages] = useState<ImageAttachment[]>([])
  const [isExpanded, setIsExpanded] = useState(false)
  const [extendedThinking, setExtendedThinking] = useState(true)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [capabilities, setCapabilities] = useState<CapabilitiesConfig | null>(null)
  const [capabilityOverrides, setCapabilityOverrides] = useState<CapabilityOverride[]>([])

  // Fetch capabilities when expanded
  useEffect(() => {
    if (isExpanded && !capabilities) {
      fetch('/api/capabilities')
        .then(res => res.json())
        .then(data => setCapabilities(data))
        .catch(err => console.error('Failed to load capabilities:', err))
    }
  }, [isExpanded, capabilities])

  const handleSubmit = () => {
    const overrides = capabilityOverrides.length > 0 ? capabilityOverrides : undefined
    const images = missionImages.length > 0 ? missionImages : undefined
    onCreateSession(mission.trim() || undefined, extendedThinking, overrides, images)
    setMission('')
    setMissionImages([])
    setIsExpanded(false)
    setShowAdvanced(false)
    setCapabilityOverrides([])
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

          <div className="space-y-3">
            <div className="relative">
              <textarea
                value={mission}
                onChange={(e) => setMission(e.target.value)}
                placeholder=">> Enter mission... (optional, e.g., Add dark mode support)"
                className="
                  w-full bg-black/50 border border-green-800/50 rounded p-3
                  text-sm text-green-300 placeholder-green-900
                  resize-none focus:outline-none focus:border-green-400 focus:box-glow
                  font-mono leading-relaxed
                "
                rows={2}
                autoFocus
              />
              <div className="absolute bottom-2 right-2 text-[9px] text-gray-800 tracking-widest">
                {mission.length} CHARS
              </div>
            </div>

            {/* Image uploader */}
            <ImageUploader
              images={missionImages}
              onImagesChange={setMissionImages}
              label="Mission Images (optional)"
            />
          </div>

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

          {/* Advanced Options Toggle */}
          <div className="mt-4">
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="flex items-center gap-2 text-xs text-gray-500 hover:text-green-400 transition-colors"
            >
              <span className={`text-[10px] transition-transform ${showAdvanced ? 'rotate-90' : ''}`}>▶</span>
              <span className="uppercase tracking-widest">Advanced Options</span>
              {capabilityOverrides.filter(o => !o.enabled).length > 0 && (
                <span className="text-[9px] px-1.5 py-0.5 bg-amber-900/50 text-amber-400 rounded">
                  {capabilityOverrides.filter(o => !o.enabled).length} modified
                </span>
              )}
            </button>

            {showAdvanced && capabilities && (
              <div className="mt-3 p-3 border border-gray-800 rounded bg-black/30">
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

            {showAdvanced && !capabilities && (
              <div className="mt-3 p-3 border border-gray-800 rounded bg-black/30 text-center">
                <span className="text-xs text-gray-600 animate-pulse">Loading capabilities...</span>
              </div>
            )}
          </div>

          <div className="flex gap-3 mt-4">
            <button
              onClick={handleSubmit}
              disabled={disabled}
              className="
                flex-1 px-5 py-2.5 rounded font-bold transition-all
                bg-green-600/20 hover:bg-green-600/30 border border-green-400
                text-green-400 hover:box-glow uppercase text-sm tracking-wider
                flex items-center justify-center gap-2 group
                disabled:opacity-50 disabled:cursor-not-allowed
              "
            >
              <span className="group-hover:animate-pulse">▶</span>
              <span>{mission.trim() ? 'Launch with Mission' : 'Launch Polish Only'}</span>
            </button>

            <button
              onClick={() => { setIsExpanded(false); setMission(''); setMissionImages([]) }}
              className="
                px-4 py-2.5 rounded font-bold transition-all
                bg-gray-800/50 hover:bg-gray-800 border border-gray-700
                text-gray-500 hover:text-gray-300 uppercase text-sm tracking-wider
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
