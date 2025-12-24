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

export interface Preset {
  extends?: string
  rules?: string[]
  thresholds?: PresetThresholds
  metrics?: Metric[]
  strategies?: Strategy[]
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
  isolation?: {
    enabled?: boolean // default: true - isolate changes in worktree
  }
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

export interface PhaseEventData {
  phase: 'implement' | 'polish'
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
