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

export type ExecutionPhase = 'implement' | 'testing' | 'review' | 'planning' | 'both'

// ============================================================================
// Review Phase Types
// ============================================================================

/** Types of reviewer agents available */
export type ReviewerType =
  | 'code_reviewer'      // Clean code, patterns, DRY, readability
  | 'senior_engineer'    // Architecture, scalability, maintainability
  | 'security_auditor'   // OWASP, vulnerabilities, secrets
  | 'mission_validator'  // Does the implementation fulfill the mission?

/** Verdict from a single reviewer */
export type ReviewVerdict =
  | 'approved'              // Good to go
  | 'needs_implementation'  // Return to Phase 1 - significant changes needed
  | 'needs_testing'         // Return to Phase 2 - improve tests/coverage
  | 'rejected'              // Mission impossible or fundamentally flawed

/** Severity of an issue found during review */
export type IssueSeverity = 'critical' | 'major' | 'minor' | 'suggestion'

/** An issue found during code review */
export interface ReviewIssue {
  id: string
  severity: IssueSeverity
  category: string           // e.g., 'security', 'architecture', 'code-quality'
  file?: string
  line?: number
  description: string
  suggestion?: string        // How to fix it
  reviewer: ReviewerType
}

/** Result from a single reviewer agent */
export interface ReviewerResult {
  reviewer: ReviewerType
  verdict: ReviewVerdict
  confidence: number         // 0-100, how confident the reviewer is
  issues: ReviewIssue[]
  summary: string
  mustFix: string[]          // Critical items that MUST be fixed
  suggestions: string[]      // Nice-to-have improvements
  timestamp: Date
}

/** Aggregated result from all reviewers */
export interface ReviewPhaseResult {
  finalVerdict: ReviewVerdict
  reviewers: ReviewerResult[]
  totalIssues: number
  criticalIssues: number
  mustFixItems: string[]
  iterationNumber: number
  returnToPhase?: 'implement' | 'testing'  // If not approved, which phase to return to
  feedbackForNextPhase?: string            // Detailed feedback for the retry
}

/** Configuration for the review phase */
export interface ReviewConfig {
  maxIterations?: number      // Max review cycles (default: 3)
  maxDuration?: number        // Max review time in ms (default: 30 min)
  reviewers?: ReviewerType[]  // Which reviewers to use (default: all)
  approvalThreshold?: 'all' | 'majority' | 'any'  // How many must approve (default: 'all')
  strictMode?: boolean        // Extra strict review (default: true)
  autoRetry?: boolean         // Auto-retry on needs_implementation/needs_testing (default: true)
}

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
 * Model size abstraction for agent configuration
 * This allows backends like OpenRouter to map to their own model equivalents:
 * - small: Fast, lightweight model (maps to haiku by default)
 * - medium: Balanced capability model (maps to sonnet by default)
 * - big: Most capable model (maps to opus by default)
 * - inherit: Use the parent agent's model
 */
export type ModelSize = 'small' | 'medium' | 'big' | 'inherit'

/**
 * Default model mapping from size to Claude model names
 * This can be overridden by the backend (e.g., OpenRouter)
 */
export const DEFAULT_MODEL_MAPPING: Record<Exclude<ModelSize, 'inherit'>, string> = {
  small: 'haiku',
  medium: 'sonnet',
  big: 'opus'
}

/**
 * Resolve a model size to an actual model name
 * @param size - The model size (small, medium, big, inherit)
 * @param customMapping - Optional custom mapping to override defaults
 * @param inheritedModel - The model to use when size is 'inherit'
 * @returns The resolved model name
 */
export function resolveModelSize(
  size: ModelSize | undefined,
  customMapping?: Partial<Record<Exclude<ModelSize, 'inherit'>, string>>,
  inheritedModel?: string
): string {
  if (!size || size === 'inherit') {
    return inheritedModel || DEFAULT_MODEL_MAPPING.medium
  }

  const mapping = { ...DEFAULT_MODEL_MAPPING, ...customMapping }
  return mapping[size]
}

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
  testing?: PhaseCapabilities      // Phase 2: Testing (metrics & fixes)
  review?: PhaseCapabilities       // Phase 3: Code Review
  polish?: PhaseCapabilities       // @deprecated - use 'testing' instead
  shared?: PhaseCapabilities       // Applied to all phases
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
    fromPhase?: 'implement' | 'testing' // Which phase to restart from
  }
  capabilityOverrides?: CapabilityOverride[] // Session-level capability overrides
  // Planning phase options
  enablePlanning?: boolean // Enable interactive planning phase before implementation
  planningThoroughness?: PlanningThoroughness // Level of exploration depth (default: 'medium')
  planningMode?: PlanningMode // How to use sub-agents (default: 'agent-driven')
  notifications?: NotificationConfig // Browser notification settings
  // Review phase options
  review?: ReviewConfig // Review phase configuration
}

// ============================================================================
// SSE Events
// ============================================================================

export type PolishEvent =
  | { type: 'init'; data: InitEventData }
  | { type: 'phase'; data: PhaseEventData }
  | { type: 'implement_done'; data: ImplementDoneEventData }
  | { type: 'testing_done'; data: TestingDoneEventData }
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
  // Review phase events
  | { type: 'review_start'; data: ReviewStartEventData }
  | { type: 'reviewer_start'; data: ReviewerStartEventData }
  | { type: 'reviewer_result'; data: ReviewerResultEventData }
  | { type: 'review_verdict'; data: ReviewVerdictEventData }
  | { type: 'review_iteration'; data: ReviewIterationEventData }

export interface PhaseEventData {
  phase: 'implement' | 'testing' | 'review' | 'planning'
  mission?: string
}

export interface TestingDoneEventData {
  finalScore: number
  totalCommits: number
  iterations: number
  stoppedReason?: 'max_score' | 'timeout' | 'plateau' | 'max_iterations'
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
// Review Phase Event Types
// ============================================================================

/** Review phase started */
export interface ReviewStartEventData {
  iteration: number
  reviewers: ReviewerType[]
  config: ReviewConfig
}

/** Individual reviewer started their review */
export interface ReviewerStartEventData {
  reviewer: ReviewerType
  iteration: number
}

/** Individual reviewer completed their review */
export interface ReviewerResultEventData {
  result: ReviewerResult
  iteration: number
}

/** Final verdict from review phase */
export interface ReviewVerdictEventData {
  verdict: ReviewVerdict
  totalIssues: number
  criticalIssues: number
  mustFixItems: string[]
  returnToPhase?: 'implement' | 'testing'
  feedbackSummary: string
  iteration: number
}

/** Review iteration completed (when returning to previous phase) */
export interface ReviewIterationEventData {
  iteration: number
  totalIterations: number
  returnToPhase: 'implement' | 'testing'
  feedback: string
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
