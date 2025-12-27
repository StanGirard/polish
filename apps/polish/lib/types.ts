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

/**
 * Model size - uses SDK-compatible model names directly
 * - haiku: Fast, lightweight model
 * - sonnet: Balanced capability model
 * - opus: Most capable model
 * - inherit: Use the parent agent's model
 */
export type ModelSize = 'haiku' | 'sonnet' | 'opus' | 'inherit'

/** Custom agent definition (matches SDK AgentDefinition) */
export interface AgentDefinition {
  description: string
  prompt: string
  tools?: string[]
  disallowedTools?: string[]
  model?: ModelSize
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

/** Thoroughness level for planning - affects how deep agents explore */
export type PlanningThoroughness = 'quick' | 'medium' | 'thorough'

/** Planning mode - controls which agents are used */
export type PlanningMode = 'auto' | 'manual' | 'agent-driven'

export interface PolishConfig {
  projectPath: string
  mission?: string
  approvedPlan?: PlanStep[] // The approved implementation plan (from planning phase)
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
  planningThoroughness?: PlanningThoroughness // Level of exploration depth (default: 'medium')
  planningMode?: PlanningMode // How to use sub-agents (default: 'agent-driven')
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
  | { type: 'aborted'; data: AbortedEventData }
  // Planning phase events
  | { type: 'plan'; data: PlanEventData }
  | { type: 'plan_message'; data: PlanMessageEventData }
  | { type: 'plan_approved'; data: PlanApprovedEventData }
  | { type: 'plan_rejected'; data: PlanRejectedEventData }
  // Planning streaming events (real-time text and thinking)
  | { type: 'plan_stream'; data: PlanStreamEventData }
  | { type: 'plan_thinking'; data: PlanThinkingEventData }

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
  phase?: 'PreToolUse' | 'PostToolUse' | 'InProgress'
  tool?: string
  input?: unknown
  output?: unknown
  message?: string
  subAgentType?: string
  // Progress event fields
  elapsedTime?: number
  toolUseId?: string
  parentToolUseId?: string | null
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

export interface AbortedEventData {
  reason?: string
  abortedAt: string
}

// ============================================================================
// Planning Phase Types
// ============================================================================

/** A step in the implementation plan */
export interface PlanStep {
  id: string
  title: string
  description: string
  rationale?: string
  files: string[]
  order: number
  dependencies?: string[]
  complexity?: 'low' | 'medium' | 'high'
  estimatedLines?: number
  testStrategy?: string
  rollbackPlan?: string
  acceptanceCriteria?: string[]
}

/** A complete implementation approach (one of several options) */
export interface PlanningApproach {
  id: string       // e.g., "approach-1", "approach-2"
  name: string     // e.g., "Conservative", "Aggressive Refactor"
  summary: string  // Detailed description of the approach
  plan: PlanStep[] // The detailed steps
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
  approaches: PlanningApproach[]
  recommendedApproachId?: string
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

/** Plan stream event - real-time text streaming during planning */
export interface PlanStreamEventData {
  chunk: string           // Text chunk being streamed
  subAgentType?: string   // If from a sub-agent, which type (Explore, Plan, etc.)
}

/** Plan thinking event - extended thinking/ultrathink streaming */
export interface PlanThinkingEventData {
  chunk: string           // Thinking text chunk
  isThinking: boolean     // Always true (for type discrimination)
  subAgentType?: string   // If from a sub-agent, which type
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

// ============================================================================
// Provider Configuration
// ============================================================================

/**
 * Supported AI provider types
 * - anthropic: Direct Anthropic API with API key
 * - anthropic_oauth: Anthropic with OAuth token (Claude Code users)
 * - openrouter: OpenRouter multi-model gateway
 * - glm: GLM/Z.ai Chinese AI provider
 * - openai_compatible: Any OpenAI-compatible API
 */
export type ProviderType =
  | 'anthropic'
  | 'anthropic_oauth'
  | 'openrouter'
  | 'glm'
  | 'openai_compatible'

/** Provider configuration stored in database */
export interface Provider {
  id: string
  name: string
  type: ProviderType
  baseUrl?: string  // Custom base URL (optional for most providers)
  apiKey: string    // API key or OAuth token
  model?: string    // Model to use (e.g., "claude-sonnet-4-20250514", "GLM-4.7")
  isDefault: boolean
  createdAt: Date
  updatedAt: Date
}

/** Provider with masked API key (for API responses) */
export interface ProviderMasked {
  id: string
  name: string
  type: ProviderType
  baseUrl?: string
  apiKeyMasked: string  // e.g., "sk-...abc1"
  model?: string
  isDefault: boolean
  createdAt: Date
  updatedAt: Date
}

/** Request to create a new provider */
export interface CreateProviderRequest {
  name: string
  type: ProviderType
  baseUrl?: string
  apiKey: string
  model?: string
  isDefault?: boolean
}

/** Request to update an existing provider */
export interface UpdateProviderRequest {
  name?: string
  baseUrl?: string
  apiKey?: string
  model?: string
  isDefault?: boolean
}

/** Default models for each provider type */
export const PROVIDER_DEFAULT_MODELS: Record<ProviderType, string> = {
  anthropic: 'claude-sonnet-4-5-20250929',
  anthropic_oauth: 'claude-sonnet-4-5-20250929',
  openrouter: 'anthropic/claude-sonnet-4.5',
  glm: 'GLM-4.7',
  openai_compatible: 'gpt-5.1'
}

/** Suggested models for each provider type */
export const PROVIDER_MODEL_OPTIONS: Record<ProviderType, string[]> = {
  anthropic: [
    'claude-opus-4-5-20251101',
    'claude-sonnet-4-5-20250929',
    'claude-haiku-4-5-20251001'
  ],
  anthropic_oauth: [
    'claude-opus-4-5-20251101',
    'claude-sonnet-4-5-20250929',
    'claude-haiku-4-5-20251001',
  ],
  openrouter: [
    'anthropic/claude-opus-4.5',
    'anthropic/claude-sonnet-4.5',
    'anthropic/claude-haiku-4.5',
    'openai/gpt-5.1',
    'openai/gpt-5.1-codex-max',
    'openai/gpt-5-mini',
    'google/gemini-3-flash-preview',
    'google/gemini-3-pro-preview'
  ],
  glm: [
    'GLM-4.7'
  ],
  openai_compatible: [
    'gpt-5.1',
    'gpt-5.1-codex-max',
    'gpt-5-mini',
    'gpt-5',
  ]
}

/** Default base URLs for each provider type */
export const PROVIDER_BASE_URLS: Record<ProviderType, string> = {
  anthropic: 'https://api.anthropic.com',
  anthropic_oauth: 'https://api.anthropic.com',
  openrouter: 'https://openrouter.ai/api/v1',
  glm: 'https://api.z.ai/api/anthropic',  // Z.ai/GLM uses Anthropic-compatible API
  openai_compatible: ''  // Required to be set by user
}

/** Human-readable provider type labels */
export const PROVIDER_TYPE_LABELS: Record<ProviderType, string> = {
  anthropic: 'Anthropic (API Key)',
  anthropic_oauth: 'Anthropic (OAuth)',
  openrouter: 'OpenRouter',
  glm: 'GLM / Z.ai',
  openai_compatible: 'OpenAI Compatible'
}
