// Core types for Polish

// ============================================================================
// Preset Configuration
// ============================================================================

export interface Metric {
  name: string
  weight: number
  command: string
  higherIsBetter: boolean
  target: number
}

export interface Strategy {
  name: string
  focus: string // metric name to improve
  prompt: string
}

export interface PresetThresholds {
  minImprovement?: number
  maxStalled?: number
  maxScore?: number
}

// ============================================================================
// Capabilities Configuration (for SDK integration)
// ============================================================================

export type ExecutionPhase = 'implement' | 'polish' | 'planning' | 'both'

/** MCP Server configuration (matches SDK McpServerConfig) */
export type McpServerConfig =
  | { type?: 'stdio'; command: string; args?: string[]; env?: Record<string, string> }
  | { type: 'sse'; url: string; headers?: Record<string, string> }
  | { type: 'http'; url: string; headers?: Record<string, string> }

/** Plugin configuration - supports bundled (with Polish) and external plugins */
export type PluginConfig =
  | { type: 'bundled'; name: string }         // Plugin bundled with Polish (in polish/plugins/)
  | { type: 'local'; path: string }           // Local plugin (absolute path or relative to Polish)
  | { type: 'npm'; package: string }          // NPM plugin (future: @polish/plugin-xxx)
  | { type: 'url'; url: string }              // Remote plugin (future: downloaded/cached)

/** SDK plugin config format */
export interface SdkPluginConfig {
  type: 'local'
  path: string
}

/** Custom agent definition (matches SDK AgentDefinition) */
export interface AgentDefinition {
  description: string
  prompt: string
  tools?: string[]
  disallowedTools?: string[]
  model?: 'sonnet' | 'opus' | 'haiku' | 'inherit'
}

/** Capabilities configuration for a specific phase */
export interface PhaseCapabilities {
  tools?: string[]                              // Available tools
  allowedTools?: string[]                       // Auto-allowed without permission
  disallowedTools?: string[]                    // Explicitly forbidden
  mcpServers?: Record<string, McpServerConfig>  // MCP servers to load
  plugins?: PluginConfig[]                      // Plugins to load
  agents?: Record<string, AgentDefinition>      // Custom sub-agents
  settingSources?: ('user' | 'project' | 'local')[]  // Settings sources to load
  systemPromptAppend?: string                   // Additional instructions
}

/** Capabilities configuration in a preset */
export interface PresetCapabilities {
  implement?: PhaseCapabilities    // Phase 1: Implementation
  polish?: PhaseCapabilities       // Phase 2: Polish loop
  shared?: PhaseCapabilities       // Applied to both phases
}

/** Session-level capability override */
export interface CapabilityOverride {
  type: 'tool' | 'mcpServer' | 'plugin' | 'agent'
  id: string
  enabled: boolean
  phases?: ExecutionPhase[]
}

/** Resolved options for SDK query() call */
export interface ResolvedQueryOptions {
  tools?: string[]
  allowedTools?: string[]
  disallowedTools?: string[]
  mcpServers?: Record<string, McpServerConfig>
  plugins?: SdkPluginConfig[]
  agents?: Record<string, AgentDefinition>
  settingSources?: ('user' | 'project' | 'local')[]
  systemPrompt?: string | { type: 'preset'; preset: 'claude_code'; append?: string }
}

export interface Preset {
  extends?: string
  rules?: string[]
  thresholds?: PresetThresholds
  metrics?: Metric[]
  strategies?: Strategy[]
  capabilities?: PresetCapabilities
}

// ============================================================================
// Runtime State
// ============================================================================

export interface MetricResult {
  name: string
  rawValue: number
  normalizedScore: number // 0-100
  weight: number
  target: number
  higherIsBetter: boolean
}

export interface ScoreResult {
  score: number // weighted average 0-100
  metrics: MetricResult[]
}

export interface FailedAttempt {
  strategy: string
  file?: string
  line?: number
  reason: 'tests_failed' | 'no_improvement' | 'error'
  timestamp: Date
}

export interface CommitInfo {
  hash: string
  message: string
  scoreDelta: number
  timestamp: Date
}

// ============================================================================
// Polish Configuration
// ============================================================================

export interface PolishConfig {
  projectPath: string
  mission?: string
  maxDuration?: number // ms, default 2 hours
  maxIterations?: number
  maxStalled?: number
  targetScore?: number
  maxThinkingTokens?: number // Extended thinking budget (default: 16000)
  isolation?: {
    enabled?: boolean // default: true - isolate changes in worktree
    existingBranch?: string // Use existing branch instead of creating new one
  }
  retry?: {
    feedback: string // User feedback explaining what to fix/improve
    retryCount: number // Number of times this session has been retried
  }
  capabilityOverrides?: CapabilityOverride[] // Session-level capability overrides
  // Planning phase options
  enablePlanning?: boolean // Enable interactive planning phase before implementation
  notifications?: NotificationConfig // Browser notification settings
}

// ============================================================================
// SSE Events
// ============================================================================

export type PolishEvent =
  | { type: 'init'; data: InitEventData }
  | { type: 'phase'; data: PhaseEventData }
  | { type: 'implement_done'; data: ImplementDoneEventData }
  | { type: 'score'; data: ScoreEventData }
  | { type: 'strategy'; data: StrategyEventData }
  | { type: 'agent'; data: AgentEventData }
  | { type: 'commit'; data: CommitEventData }
  | { type: 'rollback'; data: RollbackEventData }
  | { type: 'result'; data: ResultEventData }
  | { type: 'error'; data: ErrorEventData }
  | { type: 'status'; data: StatusEventData }
  | { type: 'worktree_created'; data: WorktreeCreatedEventData }
  | { type: 'worktree_cleanup'; data: WorktreeCleanupEventData }
  | { type: 'session_summary'; data: SessionSummaryEventData }
  | { type: 'retry'; data: RetryEventData }
  // Planning phase events
  | { type: 'plan'; data: PlanEventData }
  | { type: 'plan_message'; data: PlanMessageEventData }
  | { type: 'plan_approved'; data: PlanApprovedEventData }
  | { type: 'plan_rejected'; data: PlanRejectedEventData }

export interface PhaseEventData {
  phase: 'implement' | 'polish' | 'planning'
  mission?: string
}

export interface ImplementDoneEventData {
  commitHash: string
  message: string
  filesCreated: string[]
  filesModified: string[]
}

export interface InitEventData {
  projectPath: string
  preset: string
  initialScore: number
  metrics: MetricResult[]
}

export interface ScoreEventData {
  score: number
  metrics: MetricResult[]
  delta?: number
}

export interface StrategyEventData {
  name: string
  focus: string
  prompt: string
  iteration: number
}

export interface AgentEventData {
  phase?: 'PreToolUse' | 'PostToolUse'
  tool?: string
  input?: unknown
  output?: unknown
  message?: string
}

export interface CommitEventData {
  hash: string
  message: string
  scoreDelta: number
  iteration: number
}

export interface RollbackEventData {
  reason: 'tests_failed' | 'no_improvement' | 'error'
  failedStrategy: string
  iteration: number
}

export interface ResultEventData {
  success: boolean
  initialScore: number
  finalScore: number
  commits: CommitInfo[]
  iterations: number
  cost?: number
  duration: number
  stoppedReason?: 'max_score' | 'timeout' | 'plateau' | 'max_iterations' | 'user_stopped'
}

export interface ErrorEventData {
  message: string
  stack?: string
}

export interface StatusEventData {
  phase: string
  message: string
  [key: string]: unknown
}

// ============================================================================
// Worktree Events
// ============================================================================

export interface WorktreeCreatedEventData {
  worktreePath: string
  branchName: string
  baseBranch: string
}

export interface WorktreeCleanupEventData {
  branchName: string
  kept: boolean
}

export interface SessionSummaryEventData {
  overview: string
  achievements: string[]
  metrics: string
  explanation: string
}

export interface RetryEventData {
  retryCount: number
  feedback: string
  originalMission?: string
}

// ============================================================================
// Planning Phase Types
// ============================================================================

/** A step in the implementation plan */
export interface PlanStep {
  id: string
  title: string
  description: string
  files: string[]
  order: number
}

/** Message in the planning conversation */
export interface PlanMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: string
}

/** Plan event data - sent when plan is generated/updated */
export interface PlanEventData {
  plan: PlanStep[]
  summary: string
  estimatedChanges: {
    filesCreated: string[]
    filesModified: string[]
    filesDeleted: string[]
  }
  risks: string[]
  questions?: string[]  // Clarifying questions for the user
}

/** Plan message event - chat message during planning */
export interface PlanMessageEventData {
  message: PlanMessage
}

/** Plan approved event */
export interface PlanApprovedEventData {
  plan: PlanStep[]
  approvedAt: string
}

/** Plan rejected event */
export interface PlanRejectedEventData {
  reason?: string  // If provided, triggers re-planning. If empty, aborts session.
  rejectedAt: string
}

// ============================================================================
// Browser Notification Types
// ============================================================================

export interface NotificationConfig {
  enabled: boolean
  events: NotificationEventType[]
}

export type NotificationEventType =
  | 'plan_ready'           // Plan ready for review
  | 'awaiting_approval'    // Waiting for user action
  | 'session_completed'    // Session finished successfully
  | 'session_failed'       // Session failed
  | 'error'                // Error occurred
