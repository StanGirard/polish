/**
 * Capabilities Resolution for Polish
 *
 * Resolves preset capabilities configuration to SDK-compatible options
 * based on execution phase and session overrides.
 */

import type {
  Preset,
  ExecutionPhase,
  CapabilityOverride,
  ResolvedQueryOptions,
  PhaseCapabilities,
  McpServerConfig,
  PluginConfig,
  AgentDefinition
} from './types'
import { resolvePluginsToSdkFormat } from './plugin-loader'

// Default tools for each phase (matches current hardcoded behavior)
const DEFAULT_IMPLEMENT_TOOLS = ['Read', 'Write', 'Edit', 'Bash', 'Glob', 'Grep', 'WebSearch', 'Task']
const DEFAULT_TESTING_TOOLS = ['Read', 'Edit', 'Bash', 'Glob', 'Grep', 'WebSearch', 'Task']
const DEFAULT_REVIEW_TOOLS = ['Read', 'Glob', 'Grep', 'Bash'] // Read-only for review
const DEFAULT_PLANNING_TOOLS = ['Read', 'Glob', 'Grep', 'Bash', 'Task'] // Read-only + exploration
// @deprecated - use DEFAULT_TESTING_TOOLS instead
const DEFAULT_POLISH_TOOLS = DEFAULT_TESTING_TOOLS

/**
 * Merge two PhaseCapabilities objects
 * Phase-specific config overrides shared config
 */
function mergePhaseCapabilities(
  shared: PhaseCapabilities | undefined,
  phase: PhaseCapabilities | undefined
): PhaseCapabilities {
  const s = shared || {}
  const p = phase || {}

  return {
    // Phase tools override shared tools entirely if specified
    tools: p.tools || s.tools,

    // Allowed/disallowed tools are concatenated
    allowedTools: [...(s.allowedTools || []), ...(p.allowedTools || [])],
    disallowedTools: [...(s.disallowedTools || []), ...(p.disallowedTools || [])],

    // MCP servers are merged (phase overrides shared)
    mcpServers: { ...(s.mcpServers || {}), ...(p.mcpServers || {}) },

    // Plugins are concatenated
    plugins: [...(s.plugins || []), ...(p.plugins || [])],

    // Agents are merged (phase overrides shared)
    agents: { ...(s.agents || {}), ...(p.agents || {}) },

    // Settings sources: phase overrides shared
    settingSources: p.settingSources || s.settingSources,

    // System prompt append: phase overrides shared
    systemPromptAppend: p.systemPromptAppend || s.systemPromptAppend
  }
}

/**
 * Apply session-level capability overrides
 */
function applyOverrides(
  capabilities: PhaseCapabilities,
  overrides: CapabilityOverride[],
  currentPhase: ExecutionPhase
): PhaseCapabilities {
  const result = { ...capabilities }

  for (const override of overrides) {
    // Check if override applies to current phase
    if (override.phases) {
      const appliesToPhase =
        override.phases.includes(currentPhase) ||
        override.phases.includes('both')
      if (!appliesToPhase) continue
    }

    switch (override.type) {
      case 'tool':
        if (!override.enabled) {
          // Add to disallowed tools
          result.disallowedTools = [...(result.disallowedTools || []), override.id]
        } else {
          // Remove from disallowed if re-enabling
          result.disallowedTools = (result.disallowedTools || []).filter(t => t !== override.id)
        }
        break

      case 'mcpServer':
        if (!override.enabled && result.mcpServers) {
          // Remove the MCP server
          const { [override.id]: _, ...rest } = result.mcpServers
          result.mcpServers = rest
        }
        break

      case 'plugin':
        if (!override.enabled) {
          // Remove matching plugin
          result.plugins = (result.plugins || []).filter(p => {
            if (p.type === 'bundled') return p.name !== override.id
            if (p.type === 'local') return p.path !== override.id
            if (p.type === 'npm') return p.package !== override.id
            return true
          })
        }
        break

      case 'agent':
        if (!override.enabled && result.agents) {
          // Remove the agent
          const { [override.id]: _, ...rest } = result.agents
          result.agents = rest
        }
        break
    }
  }

  return result
}

/**
 * Resolve capabilities for a specific execution phase
 *
 * @param preset - The loaded preset configuration
 * @param phase - Current execution phase ('implement' or 'polish')
 * @param overrides - Session-level capability overrides
 * @returns Resolved options ready for SDK query() call
 */
export function resolveCapabilitiesForPhase(
  preset: Preset,
  phase: ExecutionPhase,
  overrides: CapabilityOverride[] = []
): ResolvedQueryOptions {
  const caps = preset.capabilities

  // Get phase-specific config
  const phaseConfig = phase === 'implement'
    ? caps?.implement
    : phase === 'testing'
      ? caps?.testing || caps?.polish // fallback to polish for backward compat
      : phase === 'review'
        ? caps?.review
        : phase === 'planning'
          ? (caps as { planning?: PhaseCapabilities })?.planning
          : caps?.polish // 'both' or unknown falls back to polish

  // Merge shared + phase-specific
  let merged = mergePhaseCapabilities(caps?.shared, phaseConfig)

  // Apply default tools if not specified
  if (!merged.tools) {
    merged.tools = phase === 'implement'
      ? DEFAULT_IMPLEMENT_TOOLS
      : phase === 'testing'
        ? DEFAULT_TESTING_TOOLS
        : phase === 'review'
          ? DEFAULT_REVIEW_TOOLS
          : phase === 'planning'
            ? DEFAULT_PLANNING_TOOLS
            : DEFAULT_POLISH_TOOLS
  }

  // Apply session overrides
  if (overrides.length > 0) {
    merged = applyOverrides(merged, overrides, phase)
  }

  // Build resolved options for SDK
  const result: ResolvedQueryOptions = {}

  // Tools
  if (merged.tools && merged.tools.length > 0) {
    result.tools = merged.tools
  }
  if (merged.allowedTools && merged.allowedTools.length > 0) {
    result.allowedTools = Array.from(new Set(merged.allowedTools)) // dedupe
  }
  if (merged.disallowedTools && merged.disallowedTools.length > 0) {
    result.disallowedTools = Array.from(new Set(merged.disallowedTools)) // dedupe
  }

  // MCP Servers
  if (merged.mcpServers && Object.keys(merged.mcpServers).length > 0) {
    result.mcpServers = merged.mcpServers
  }

  // Plugins - convert to SDK format
  if (merged.plugins && merged.plugins.length > 0) {
    result.plugins = resolvePluginsToSdkFormat(merged.plugins, { validate: true })
  }

  // Agents
  if (merged.agents && Object.keys(merged.agents).length > 0) {
    result.agents = merged.agents
  }

  // Settings sources
  if (merged.settingSources && merged.settingSources.length > 0) {
    result.settingSources = merged.settingSources
  }

  // System prompt
  if (merged.systemPromptAppend) {
    result.systemPrompt = {
      type: 'preset',
      preset: 'claude_code',
      append: merged.systemPromptAppend
    }
  }

  return result
}

/**
 * Get available capabilities from a preset (for UI display)
 */
export function getAvailableCapabilities(preset: Preset): {
  tools: string[]
  mcpServers: string[]
  plugins: Array<{ type: string; id: string }>
  agents: string[]
} {
  const caps = preset.capabilities
  const shared = caps?.shared || {}
  const implement = caps?.implement || {}
  const testing = caps?.testing || caps?.polish || {}
  const review = caps?.review || {}

  // Collect all unique tools
  const tools = new Set<string>([
    ...(shared.tools || DEFAULT_IMPLEMENT_TOOLS),
    ...(implement.tools || []),
    ...(testing.tools || []),
    ...(review.tools || [])
  ])

  // Collect all MCP servers
  const mcpServers = new Set<string>([
    ...Object.keys(shared.mcpServers || {}),
    ...Object.keys(implement.mcpServers || {}),
    ...Object.keys(testing.mcpServers || {}),
    ...Object.keys(review.mcpServers || {})
  ])

  // Collect all plugins
  const plugins: Array<{ type: string; id: string }> = []
  const allPlugins = [
    ...(shared.plugins || []),
    ...(implement.plugins || []),
    ...(testing.plugins || []),
    ...(review.plugins || [])
  ]
  const seenPlugins = new Set<string>()

  for (const p of allPlugins) {
    const id = p.type === 'bundled' ? p.name :
               p.type === 'local' ? p.path :
               p.type === 'npm' ? p.package :
               p.url
    if (!seenPlugins.has(id)) {
      seenPlugins.add(id)
      plugins.push({ type: p.type, id })
    }
  }

  // Collect all agents
  const agents = new Set<string>([
    ...Object.keys(shared.agents || {}),
    ...Object.keys(implement.agents || {}),
    ...Object.keys(testing.agents || {}),
    ...Object.keys(review.agents || {})
  ])

  return {
    tools: Array.from(tools),
    mcpServers: Array.from(mcpServers),
    plugins,
    agents: Array.from(agents)
  }
}

/**
 * Check if capabilities are configured (for backward compatibility)
 */
export function hasCapabilitiesConfig(preset: Preset): boolean {
  return preset.capabilities !== undefined
}
