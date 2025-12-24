export interface Metric {
  name: string
  weight: number
  command: string
  higherIsBetter: boolean
  target: number
}

export interface Strategy {
  name: string
  focus: string // name of the targeted metric
  prompt: string
}

export interface Config {
  metrics: Metric[]
  strategies: Strategy[]
  rules: string[]
  thresholds: {
    minImprovement: number // minimum score delta to commit (e.g., 0.5)
    maxStalled: number // iterations without gain before strategy change
    maxScore: number // stop if reached (e.g., 90)
  }
}

export interface ScoreResult {
  total: number
  details: Record<string, number> // score per metric (0-100)
  values: Record<string, number | string> // raw value per metric
  diagnostics: Record<string, string> // actionable diagnostic per metric
}

export interface Failure {
  iteration: number
  strategy: string
  target: string
  reason: 'tests_failed' | 'no_improvement' | 'error'
  error?: string
}

export interface JobState {
  repo: string
  branch: string
  iteration: number
  scoreHistory: number[]
  currentStrategyIndex: number
  stalledCount: number
  failures: Failure[]
  commits: string[]
  startedAt: Date
  duration: number
}

export interface JobResult {
  scoreBefore: number
  scoreAfter: number
  iterations: number
  commits: string[]
  prUrl?: string
  durationSeconds: number
  costEstimate: number
}

export interface FileChange {
  path: string
  content: string
}

export interface LLMResponse {
  explanation: string
  files: FileChange[]
  skip: boolean
  tokensUsed: number
}
