/**
 * Tool Call Logger
 *
 * Provides enhanced logging capabilities for tool calls with:
 * - Structured logging with contextual information
 * - Performance tracking
 * - Statistics collection
 * - Configurable verbosity levels
 */

import type { PreToolUseHookInput, PostToolUseHookInput } from '@anthropic-ai/claude-agent-sdk'

// ============================================================================
// Types
// ============================================================================

export type LogLevel = 'minimal' | 'normal' | 'verbose' | 'debug'

export interface ToolCallMetadata {
  toolName: string
  phase: 'PreToolUse' | 'PostToolUse'
  timestamp: Date
  duration?: number // ms (for PostToolUse)
  inputSize?: number // bytes
  outputSize?: number // bytes
  success?: boolean
  error?: string
  subAgentType?: string
}

export interface ToolCallStats {
  totalCalls: number
  callsByTool: Record<string, number>
  callsByPhase: Record<string, number>
  totalDuration: number
  averageDuration: number
  errors: number
  subAgentCalls: number
}

// ============================================================================
// Tool Call Tracker
// ============================================================================

export class ToolCallTracker {
  private calls: ToolCallMetadata[] = []
  private pendingCalls: Map<string, { toolName: string; timestamp: Date }> = new Map()
  private logLevel: LogLevel = 'normal'

  constructor(logLevel: LogLevel = 'normal') {
    this.logLevel = logLevel
  }

  /**
   * Track a PreToolUse event
   */
  trackPreToolUse(input: PreToolUseHookInput): ToolCallMetadata {
    const metadata: ToolCallMetadata = {
      toolName: input.tool_name,
      phase: 'PreToolUse',
      timestamp: new Date(),
      inputSize: this.calculateSize(input.tool_input)
    }

    // Extract sub-agent type if applicable
    if (input.tool_name === 'Task' && input.tool_input) {
      metadata.subAgentType = (input.tool_input as { subagent_type?: string }).subagent_type
    }

    // Store for pairing with PostToolUse
    const callId = this.generateCallId(input)
    this.pendingCalls.set(callId, {
      toolName: input.tool_name,
      timestamp: metadata.timestamp
    })

    this.calls.push(metadata)
    return metadata
  }

  /**
   * Track a PostToolUse event
   */
  trackPostToolUse(input: PostToolUseHookInput): ToolCallMetadata {
    const callId = this.generateCallId(input)
    const pending = this.pendingCalls.get(callId)

    const metadata: ToolCallMetadata = {
      toolName: input.tool_name,
      phase: 'PostToolUse',
      timestamp: new Date(),
      outputSize: this.calculateSize(input.tool_response),
      duration: pending ? Date.now() - pending.timestamp.getTime() : undefined,
      success: !this.isErrorResponse(input.tool_response)
    }

    // Extract sub-agent type if applicable
    if (input.tool_name === 'Task' && input.tool_input) {
      metadata.subAgentType = (input.tool_input as { subagent_type?: string }).subagent_type
    }

    // Check for error
    if (this.isErrorResponse(input.tool_response)) {
      metadata.error = this.extractErrorMessage(input.tool_response)
    }

    // Clear pending
    if (pending) {
      this.pendingCalls.delete(callId)
    }

    this.calls.push(metadata)
    return metadata
  }

  /**
   * Get statistics for all tracked calls
   */
  getStats(): ToolCallStats {
    const stats: ToolCallStats = {
      totalCalls: 0,
      callsByTool: {},
      callsByPhase: {},
      totalDuration: 0,
      averageDuration: 0,
      errors: 0,
      subAgentCalls: 0
    }

    let durationCount = 0

    for (const call of this.calls) {
      stats.totalCalls++

      // Count by tool
      stats.callsByTool[call.toolName] = (stats.callsByTool[call.toolName] || 0) + 1

      // Count by phase
      stats.callsByPhase[call.phase] = (stats.callsByPhase[call.phase] || 0) + 1

      // Track duration
      if (call.duration) {
        stats.totalDuration += call.duration
        durationCount++
      }

      // Track errors
      if (call.error || call.success === false) {
        stats.errors++
      }

      // Track sub-agent calls
      if (call.subAgentType) {
        stats.subAgentCalls++
      }
    }

    // Calculate average duration
    if (durationCount > 0) {
      stats.averageDuration = stats.totalDuration / durationCount
    }

    return stats
  }

  /**
   * Format a tool call for logging
   */
  formatToolCall(
    metadata: ToolCallMetadata,
    input?: unknown,
    output?: unknown
  ): string {
    const lines: string[] = []

    // Header with tool name and phase
    const icon = metadata.phase === 'PreToolUse' ? '▸' : '✓'
    const color = metadata.phase === 'PreToolUse' ? '\x1b[36m' : '\x1b[32m' // cyan : green
    const reset = '\x1b[0m'

    let header = `${color}${icon} ${metadata.toolName.toUpperCase()}${reset}`

    // Add sub-agent type if applicable
    if (metadata.subAgentType) {
      header += ` ${color}[${metadata.subAgentType}]${reset}`
    }

    lines.push(header)

    // Add timing info for PostToolUse
    if (metadata.phase === 'PostToolUse' && metadata.duration) {
      const durationStr = this.formatDuration(metadata.duration)
      lines.push(`  ⏱️  ${durationStr}`)
    }

    // Add sizes
    if (this.logLevel === 'verbose' || this.logLevel === 'debug') {
      if (metadata.inputSize) {
        lines.push(`  📥 Input: ${this.formatSize(metadata.inputSize)}`)
      }
      if (metadata.outputSize) {
        lines.push(`  📤 Output: ${this.formatSize(metadata.outputSize)}`)
      }
    }

    // Add error info
    if (metadata.error) {
      lines.push(`  ❌ Error: ${metadata.error}`)
    }

    // Add detailed input/output for debug mode
    if (this.logLevel === 'debug') {
      if (metadata.phase === 'PreToolUse' && input) {
        const inputStr = this.formatData(input)
        lines.push(`  📋 Input:\n${this.indent(inputStr, 4)}`)
      }
      if (metadata.phase === 'PostToolUse' && output) {
        const outputStr = this.formatData(output, 200)
        lines.push(`  📄 Output:\n${this.indent(outputStr, 4)}`)
      }
    }

    return lines.join('\n')
  }

  /**
   * Get a summary of all tool calls
   */
  getSummary(): string {
    const stats = this.getStats()
    const lines: string[] = []

    lines.push('\n📊 Tool Call Statistics')
    lines.push('=' .repeat(50))
    lines.push(`Total calls: ${stats.totalCalls}`)
    lines.push(`Sub-agent calls: ${stats.subAgentCalls}`)
    lines.push(`Errors: ${stats.errors}`)
    lines.push(`Total duration: ${this.formatDuration(stats.totalDuration)}`)
    lines.push(`Average duration: ${this.formatDuration(stats.averageDuration)}`)

    lines.push('\nCalls by tool:')
    for (const [tool, count] of Object.entries(stats.callsByTool).sort((a, b) => b[1] - a[1])) {
      lines.push(`  ${tool}: ${count}`)
    }

    return lines.join('\n')
  }

  /**
   * Reset all tracked data
   */
  reset(): void {
    this.calls = []
    this.pendingCalls.clear()
  }

  // ============================================================================
  // Private Helpers
  // ============================================================================

  private generateCallId(input: PreToolUseHookInput | PostToolUseHookInput): string {
    // Use tool name + timestamp as a simple ID
    // In a real implementation, we'd use a more robust ID from the SDK
    return `${input.tool_name}-${Date.now()}`
  }

  private calculateSize(data: unknown): number {
    try {
      return JSON.stringify(data).length
    } catch {
      return 0
    }
  }

  private isErrorResponse(response: unknown): boolean {
    if (typeof response === 'string') {
      return response.toLowerCase().includes('error') || response.toLowerCase().includes('failed')
    }
    if (typeof response === 'object' && response !== null) {
      return 'error' in response || 'errors' in response
    }
    return false
  }

  private extractErrorMessage(response: unknown): string {
    if (typeof response === 'string') {
      return response.slice(0, 100)
    }
    if (typeof response === 'object' && response !== null) {
      if ('error' in response) {
        return String((response as { error: unknown }).error).slice(0, 100)
      }
    }
    return 'Unknown error'
  }

  private formatDuration(ms: number): string {
    if (ms < 1000) {
      return `${ms.toFixed(0)}ms`
    }
    return `${(ms / 1000).toFixed(2)}s`
  }

  private formatSize(bytes: number): string {
    if (bytes < 1024) {
      return `${bytes}B`
    }
    if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(1)}KB`
    }
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`
  }

  private formatData(data: unknown, maxLength: number = 500): string {
    try {
      const str = typeof data === 'string' ? data : JSON.stringify(data, null, 2)
      if (str.length > maxLength) {
        return str.slice(0, maxLength) + '...'
      }
      return str
    } catch {
      return '[Unable to serialize]'
    }
  }

  private indent(text: string, spaces: number): string {
    const prefix = ' '.repeat(spaces)
    return text.split('\n').map(line => prefix + line).join('\n')
  }
}

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Create a logging hook callback with the specified log level
 */
export function createToolLogger(logLevel: LogLevel = 'normal'): {
  tracker: ToolCallTracker
  hook: (input: PreToolUseHookInput | PostToolUseHookInput) => Promise<Record<string, never>>
} {
  const tracker = new ToolCallTracker(logLevel)

  const hook = async (input: PreToolUseHookInput | PostToolUseHookInput) => {
    let metadata: ToolCallMetadata

    if (input.hook_event_name === 'PreToolUse') {
      metadata = tracker.trackPreToolUse(input as PreToolUseHookInput)

      if (logLevel !== 'minimal') {
        console.log(tracker.formatToolCall(
          metadata,
          (input as PreToolUseHookInput).tool_input
        ))
      }
    } else if (input.hook_event_name === 'PostToolUse') {
      const postInput = input as PostToolUseHookInput
      metadata = tracker.trackPostToolUse(postInput)

      if (logLevel !== 'minimal') {
        console.log(tracker.formatToolCall(
          metadata,
          postInput.tool_input,
          postInput.tool_response
        ))
      }
    }

    return {}
  }

  return { tracker, hook }
}

/**
 * Console logger that outputs tool calls in a pretty format
 */
export function logToolCall(
  toolName: string,
  phase: 'PreToolUse' | 'PostToolUse',
  input?: unknown,
  output?: unknown,
  duration?: number
): void {
  const tracker = new ToolCallTracker('verbose')
  const metadata: ToolCallMetadata = {
    toolName,
    phase,
    timestamp: new Date(),
    duration,
    inputSize: input ? JSON.stringify(input).length : undefined,
    outputSize: output ? JSON.stringify(output).length : undefined
  }

  console.log(tracker.formatToolCall(metadata, input, output))
}
