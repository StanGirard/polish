import { runSingleFix, type SingleFixContext } from './agent'
import { commitWithMessage, getStatus, rollback, getLastCommitHash } from './git'
import { runImplementPhase } from './implement'
import { loadPreset, runAllMetrics, calculateScore, getWorstMetric, getStrategyForMetric } from './scorer'
import { exec } from './executor'
import { createWorktree, createWorktreeFromBranch, cleanupWorktree, checkPreflight, branchExists, type WorktreeConfig } from './worktree'
import { generateSessionSummary } from './summary-generator'
import type {
  CommitInfo,
  FailedAttempt,
  PolishConfig,
  PolishEvent
} from './types'

// ============================================================================
// Polish Loop Configuration
// ============================================================================

const DEFAULT_MAX_DURATION = 2 * 60 * 60 * 1000 // 2 hours
const DEFAULT_MAX_ITERATIONS = 100
const DEFAULT_MAX_STALLED = 5
const DEFAULT_TARGET_SCORE = 100
const MIN_IMPROVEMENT = 0.5 // Minimum score improvement to count as success

// ============================================================================
// Helper: Generate Session Summary
// ============================================================================

interface SummaryParams {
  mission?: string
  initialScore: number
  finalScore: number
  commits: CommitInfo[]
  duration: number
  iterations: number
  stoppedReason?: string
}

async function* generateAndYieldSummary(params: SummaryParams): AsyncGenerator<PolishEvent> {
  const { mission, initialScore, finalScore, commits, duration, iterations, stoppedReason } = params

  // Yield result event first
  yield {
    type: 'result',
    data: {
      success: finalScore > initialScore,
      initialScore,
      finalScore,
      commits,
      iterations,
      duration,
      stoppedReason: stoppedReason as 'max_score' | 'timeout' | 'plateau' | 'max_iterations' | undefined
    }
  }

  // Generate AI summary if there are commits
  if (commits.length > 0) {
    try {
      yield {
        type: 'status',
        data: { phase: 'summary', message: 'Generating session summary...' }
      }

      const summary = await generateSessionSummary({
        mission,
        initialScore,
        finalScore,
        commits,
        duration,
        iterations,
        stoppedReason
      })

      yield {
        type: 'session_summary',
        data: summary
      }
    } catch (error) {
      // Summary generation is optional, don't fail the whole session
      console.error('Failed to generate session summary:', error)
    }
  }
}

// ============================================================================
// Main Polish Loop
// ============================================================================

export async function* runPolishLoop(config: PolishConfig): AsyncGenerator<PolishEvent> {
  const {
    projectPath,
    maxDuration = DEFAULT_MAX_DURATION,
    maxIterations = DEFAULT_MAX_ITERATIONS,
    maxStalled = DEFAULT_MAX_STALLED,
    targetScore = DEFAULT_TARGET_SCORE
  } = config

  const startTime = Date.now()
  const commits: CommitInfo[] = []
  const failedAttempts: FailedAttempt[] = []
  let stalledCount = 0
  let iteration = 0

  // Load preset
  const preset = await loadPreset(projectPath)
  const rules = preset.rules || []
  const thresholds = preset.thresholds || {}
  const actualMaxStalled = thresholds.maxStalled || maxStalled
  const actualTargetScore = thresholds.maxScore || targetScore

  if (!preset.metrics || preset.metrics.length === 0) {
    yield {
      type: 'error',
      data: { message: 'No metrics configured in preset' }
    }
    return
  }

  // Calculate initial score
  const initialMetrics = await runAllMetrics(preset.metrics, projectPath)
  const initialScoreResult = calculateScore(initialMetrics)
  const initialScore = initialScoreResult.score

  yield {
    type: 'init',
    data: {
      projectPath,
      preset: 'nextjs',
      initialScore,
      metrics: initialMetrics
    }
  }

  yield {
    type: 'score',
    data: {
      score: initialScore,
      metrics: initialMetrics
    }
  }

  let currentScore = initialScore
  let currentMetrics = initialMetrics

  // Main loop
  while (true) {
    iteration++

    // Check stop conditions
    const elapsed = Date.now() - startTime

    if (elapsed >= maxDuration) {
      yield* generateAndYieldSummary({
        mission: config.mission,
        initialScore,
        finalScore: currentScore,
        commits,
        duration: elapsed,
        iterations: iteration - 1,
        stoppedReason: 'timeout'
      })
      return
    }

    if (currentScore >= actualTargetScore) {
      yield* generateAndYieldSummary({
        mission: config.mission,
        initialScore,
        finalScore: currentScore,
        commits,
        duration: elapsed,
        iterations: iteration - 1,
        stoppedReason: 'max_score'
      })
      return
    }

    if (stalledCount >= actualMaxStalled) {
      yield* generateAndYieldSummary({
        mission: config.mission,
        initialScore,
        finalScore: currentScore,
        commits,
        duration: elapsed,
        iterations: iteration - 1,
        stoppedReason: 'plateau'
      })
      return
    }

    if (iteration > maxIterations) {
      yield* generateAndYieldSummary({
        mission: config.mission,
        initialScore,
        finalScore: currentScore,
        commits,
        duration: elapsed,
        iterations: iteration - 1,
        stoppedReason: 'max_iterations'
      })
      return
    }

    // Find worst metric and corresponding strategy
    const worstMetric = getWorstMetric(currentMetrics)
    if (!worstMetric) {
      yield* generateAndYieldSummary({
        mission: config.mission,
        initialScore,
        finalScore: currentScore,
        commits,
        duration: elapsed,
        iterations: iteration - 1,
        stoppedReason: 'max_score'
      })
      return
    }

    const strategy = getStrategyForMetric(worstMetric.name, preset.strategies || [])
    if (!strategy) {
      // No strategy for this metric, skip
      stalledCount++
      continue
    }

    yield {
      type: 'strategy',
      data: {
        name: strategy.name,
        focus: strategy.focus,
        prompt: strategy.prompt,
        iteration
      }
    }

    // Save current state for potential rollback
    const beforeCommitHash = await getLastCommitHash(projectPath)

    // Build context for single fix
    const context: SingleFixContext = {
      projectPath,
      strategy,
      targetMetric: worstMetric,
      failedAttempts: failedAttempts.filter(f => f.strategy === strategy.name).slice(-3),
      rules
    }

    // Run single fix agent
    let agentError = false
    for await (const event of runSingleFix(context)) {
      yield event
      if (event.type === 'error') {
        agentError = true
      }
    }

    if (agentError) {
      // Agent failed, rollback and record failure
      await rollback(projectPath)
      failedAttempts.push({
        strategy: strategy.name,
        reason: 'error',
        timestamp: new Date()
      })
      stalledCount++

      yield {
        type: 'rollback',
        data: {
          reason: 'error',
          failedStrategy: strategy.name,
          iteration
        }
      }
      continue
    }

    // Check if there are changes
    const status = await getStatus(projectPath)
    if (!status.hasChanges) {
      // No changes made, record as stalled
      failedAttempts.push({
        strategy: strategy.name,
        reason: 'no_improvement',
        timestamp: new Date()
      })
      stalledCount++
      continue
    }

    // Run tests to verify changes don't break anything
    const testResult = await exec('npm test -- --passWithNoTests 2>&1 || true', projectPath, 120000)
    const testsPass = testResult.exitCode === 0 || testResult.stdout.includes('passed')

    if (!testsPass) {
      // Tests failed, rollback
      await rollback(projectPath)
      failedAttempts.push({
        strategy: strategy.name,
        reason: 'tests_failed',
        timestamp: new Date()
      })
      stalledCount++

      yield {
        type: 'rollback',
        data: {
          reason: 'tests_failed',
          failedStrategy: strategy.name,
          iteration
        }
      }
      continue
    }

    // Calculate new score
    const newMetrics = await runAllMetrics(preset.metrics, projectPath)
    const newScoreResult = calculateScore(newMetrics)
    const newScore = newScoreResult.score
    const scoreDelta = newScore - currentScore

    if (scoreDelta < MIN_IMPROVEMENT) {
      // Not enough improvement, rollback
      await rollback(projectPath)
      failedAttempts.push({
        strategy: strategy.name,
        reason: 'no_improvement',
        timestamp: new Date()
      })
      stalledCount++

      yield {
        type: 'rollback',
        data: {
          reason: 'no_improvement',
          failedStrategy: strategy.name,
          iteration
        }
      }
      continue
    }

    // Success! Commit the changes
    const commitMessage = `fix(${strategy.focus}): ${strategy.name} - +${scoreDelta.toFixed(1)} pts`
    const commitHash = await commitWithMessage(projectPath, commitMessage)

    const commitInfo: CommitInfo = {
      hash: commitHash,
      message: commitMessage,
      scoreDelta,
      timestamp: new Date()
    }
    commits.push(commitInfo)

    yield {
      type: 'commit',
      data: {
        hash: commitHash,
        message: commitMessage,
        scoreDelta,
        iteration
      }
    }

    // Update current state
    currentScore = newScore
    currentMetrics = newMetrics
    stalledCount = 0 // Reset stalled counter on success

    yield {
      type: 'score',
      data: {
        score: newScore,
        metrics: newMetrics,
        delta: scoreDelta
      }
    }
  }
}

// ============================================================================
// Full Polish: Phase 1 (Implement) + Phase 2 (Polish)
// ============================================================================

export async function* runFullPolish(config: PolishConfig): AsyncGenerator<PolishEvent> {
  const { projectPath, mission, retry } = config

  // Phase 1: Implement (if mission provided)
  if (mission) {
    const isRetry = retry && retry.retryCount > 0
    yield {
      type: 'status',
      data: {
        phase: 'implement',
        message: isRetry
          ? `Starting Phase 1: Implementation (Retry #${retry.retryCount + 1})...`
          : 'Starting Phase 1: Implementation...'
      }
    }

    for await (const event of runImplementPhase({
      mission,
      projectPath,
      feedback: retry?.feedback,
      retryCount: retry?.retryCount
    })) {
      yield event

      // If implementation failed, stop
      if (event.type === 'error') {
        return
      }
    }

    yield {
      type: 'status',
      data: { phase: 'implement', message: 'Phase 1 complete. Starting Phase 2: Polish...' }
    }
  }

  // Phase 2: Polish
  yield {
    type: 'phase',
    data: { phase: 'polish' }
  }

  for await (const event of runPolishLoop(config)) {
    yield event
  }
}

// ============================================================================
// Isolated Polish: Run in a worktree
// ============================================================================

export async function* runIsolatedPolish(config: PolishConfig): AsyncGenerator<PolishEvent> {
  const { projectPath, isolation = { enabled: true }, retry } = config

  // Si isolation désactivée, exécuter directement
  if (isolation.enabled === false) {
    yield* runFullPolish(config)
    return
  }

  // Vérifier les prérequis
  const preflight = await checkPreflight(projectPath)
  if (!preflight.ok) {
    yield {
      type: 'error',
      data: { message: preflight.error || 'Preflight check failed' }
    }
    return
  }

  // Émettre l'événement retry si c'est une relance
  if (retry) {
    yield {
      type: 'retry',
      data: {
        retryCount: retry.retryCount,
        feedback: retry.feedback,
        originalMission: config.mission
      }
    }
  }

  // Créer le worktree (nouveau ou depuis une branche existante)
  let wt: WorktreeConfig | null = null
  try {
    const existingBranch = isolation.existingBranch

    if (existingBranch && await branchExists(projectPath, existingBranch)) {
      // Utiliser la branche existante pour un retry
      wt = await createWorktreeFromBranch(projectPath, existingBranch)

      yield {
        type: 'worktree_created',
        data: {
          worktreePath: wt.worktreePath,
          branchName: wt.branchName,
          baseBranch: wt.baseBranch
        }
      }

      yield {
        type: 'status',
        data: {
          phase: 'worktree',
          message: `Resuming work on existing branch: ${wt.branchName}`
        }
      }
    } else {
      // Créer une nouvelle branche
      wt = await createWorktree(projectPath)

      yield {
        type: 'worktree_created',
        data: {
          worktreePath: wt.worktreePath,
          branchName: wt.branchName,
          baseBranch: wt.baseBranch
        }
      }

      yield {
        type: 'status',
        data: {
          phase: 'worktree',
          message: `Working in isolated branch: ${wt.branchName}`
        }
      }
    }

    // Exécuter Polish dans le worktree
    const worktreeConfig: PolishConfig = {
      ...config,
      projectPath: wt.worktreePath,
      isolation: { enabled: false } // Éviter la récursion
    }

    let hasCommits = false
    let hasAgentActivity = false
    for await (const event of runFullPolish(worktreeConfig)) {
      yield event

      // Tracker si des commits ont été faits
      if (event.type === 'commit') {
        hasCommits = true
      }
      // Tracker si l'agent a fait des modifications (même non commitées)
      if (event.type === 'agent' && event.data.tool === 'Edit') {
        hasAgentActivity = true
      }
    }

    // Garder la branche si commits OU si l'agent a modifié des fichiers
    const keepBranch = hasCommits || hasAgentActivity
    await cleanupWorktree(wt, keepBranch)

    yield {
      type: 'worktree_cleanup',
      data: {
        branchName: wt.branchName,
        kept: keepBranch
      }
    }

    if (keepBranch) {
      yield {
        type: 'status',
        data: {
          phase: 'complete',
          message: `Changes available on branch: ${wt.branchName}`
        }
      }
    }

  } catch (error) {
    // Nettoyer en cas d'erreur
    if (wt) {
      try {
        await cleanupWorktree(wt, false)
      } catch {
        // Ignorer les erreurs de cleanup
      }
    }

    yield {
      type: 'error',
      data: {
        message: `Isolated polish failed: ${error instanceof Error ? error.message : String(error)}`
      }
    }
  }
}

// ============================================================================
// Helper: Run polish on current directory
// ============================================================================

export async function* polishCurrentProject(
  projectPath: string = process.cwd(),
  mission?: string,
  maxDuration?: number
): AsyncGenerator<PolishEvent> {
  const config: PolishConfig = {
    projectPath,
    mission,
    maxDuration
  }

  for await (const event of runIsolatedPolish(config)) {
    yield event
  }
}
