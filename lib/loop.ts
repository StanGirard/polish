import { runSingleFix, type SingleFixContext } from './agent'
import { commitWithMessage, getStatus, rollback, getLastCommitHash } from './git'
import { runImplementPhase } from './implement'
import { runReviewPhase, type ReviewContext, DEFAULT_REVIEW_CONFIG } from './review'
import { loadPreset, runAllMetrics, calculateScore, getWorstMetric, getStrategyForMetric } from './scorer'
import { exec } from './executor'
import { createWorktree, createWorktreeFromBranch, cleanupWorktree, checkPreflight, branchExists, type WorktreeConfig } from './worktree'
import { generateSessionSummary } from './summary-generator'
import { resolveCapabilitiesForPhase } from './capabilities'
import type {
  CommitInfo,
  FailedAttempt,
  PolishConfig,
  PolishEvent,
  ResolvedQueryOptions,
  ReviewPhaseResult,
  ReviewConfig,
} from './types'

// ============================================================================
// Polish Loop Configuration
// ============================================================================

const DEFAULT_MAX_DURATION = 2 * 60 * 60 * 1000 // 2 hours
const DEFAULT_MAX_ITERATIONS = 100
const DEFAULT_MAX_STALLED = 5
const DEFAULT_TARGET_SCORE = 100
const MIN_IMPROVEMENT = 0.5 // Minimum score improvement to count as success

// Review phase defaults
const DEFAULT_MAX_REVIEW_ITERATIONS = 3

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
  reviewIterations?: number
}

async function* generateAndYieldSummary(params: SummaryParams): AsyncGenerator<PolishEvent> {
  const { mission, initialScore, finalScore, commits, duration, iterations, stoppedReason } = params

  // Yield result event first
  // Success is determined by:
  // - max_score reached: always success (we achieved the target)
  // - score improved: success
  // - no regression: also considered success if we started at target
  const isSuccess = stoppedReason === 'max_score' || stoppedReason === 'review_approved' || finalScore >= initialScore

  yield {
    type: 'result',
    data: {
      success: isSuccess,
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
// Phase 2: Testing Loop (formerly Polish Loop)
// ============================================================================

export interface TestingLoopResult {
  finalScore: number
  totalCommits: number
  iterations: number
  stoppedReason?: 'max_score' | 'timeout' | 'plateau' | 'max_iterations'
}

export async function* runTestingLoop(
  config: PolishConfig,
  queryOptions?: ResolvedQueryOptions
): AsyncGenerator<PolishEvent, TestingLoopResult> {
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
    return { finalScore: 0, totalCommits: 0, iterations: 0 }
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
  let stoppedReason: 'max_score' | 'timeout' | 'plateau' | 'max_iterations' | undefined

  // Main loop
  while (true) {
    iteration++

    // Check stop conditions
    const elapsed = Date.now() - startTime

    if (elapsed >= maxDuration) {
      const durationMin = Math.round(elapsed / 60000)
      yield {
        type: 'status',
        data: {
          phase: 'complete',
          message: `Stopping: timeout after ${durationMin} minutes`
        }
      }
      stoppedReason = 'timeout'
      break
    }

    if (currentScore >= actualTargetScore) {
      yield {
        type: 'status',
        data: {
          phase: 'complete',
          message: `Score ${currentScore.toFixed(1)} meets target (${actualTargetScore}).`
        }
      }
      stoppedReason = 'max_score'
      break
    }

    if (stalledCount >= actualMaxStalled) {
      yield {
        type: 'status',
        data: {
          phase: 'complete',
          message: `Stopping: ${actualMaxStalled} consecutive attempts without improvement`
        }
      }
      stoppedReason = 'plateau'
      break
    }

    if (iteration > maxIterations) {
      yield {
        type: 'status',
        data: {
          phase: 'complete',
          message: `Stopping: reached maximum iterations (${maxIterations})`
        }
      }
      stoppedReason = 'max_iterations'
      break
    }

    // Find worst metric and corresponding strategy
    const worstMetric = getWorstMetric(currentMetrics)
    if (!worstMetric) {
      stoppedReason = 'max_score'
      break
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

    // Run single fix agent with resolved capabilities
    let agentError = false
    for await (const event of runSingleFix(context, queryOptions)) {
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

  // Emit testing_done event
  yield {
    type: 'testing_done',
    data: {
      finalScore: currentScore,
      totalCommits: commits.length,
      iterations: iteration - 1,
      stoppedReason
    }
  }

  return {
    finalScore: currentScore,
    totalCommits: commits.length,
    iterations: iteration - 1,
    stoppedReason
  }
}

// Keep old name for backward compatibility
export const runPolishLoop = runTestingLoop

// ============================================================================
// Full Polish: Phase 1 (Implement) + Phase 2 (Testing) + Phase 3 (Review)
// ============================================================================

interface FullPolishState {
  commits: CommitInfo[]
  initialScore: number
  finalScore: number
  iterations: number
  reviewIterations: number
}

export async function* runFullPolish(config: PolishConfig): AsyncGenerator<PolishEvent> {
  const {
    projectPath,
    mission,
    retry,
    capabilityOverrides = [],
    review: reviewConfig = {}
  } = config

  // Load preset for capabilities resolution
  const preset = await loadPreset(projectPath)

  // Merge review config with defaults
  const effectiveReviewConfig: ReviewConfig = {
    ...DEFAULT_REVIEW_CONFIG,
    ...reviewConfig
  }

  const maxReviewIterations = effectiveReviewConfig.maxIterations || DEFAULT_MAX_REVIEW_ITERATIONS
  let reviewIteration = 0
  let currentPhase: 'implement' | 'testing' = retry?.fromPhase || 'implement'

  // Track state across iterations
  const state: FullPolishState = {
    commits: [],
    initialScore: 0,
    finalScore: 0,
    iterations: 0,
    reviewIterations: 0
  }

  // Main loop: can iterate between phases based on review feedback
  while (reviewIteration < maxReviewIterations) {
    reviewIteration++
    state.reviewIterations = reviewIteration

    // ========================================================================
    // Phase 1: Implement (if mission provided and we're starting from implement)
    // ========================================================================
    if (mission && currentPhase === 'implement') {
      const isRetry = (retry && retry.retryCount > 0) || reviewIteration > 1
      yield {
        type: 'phase',
        data: { phase: 'implement', mission }
      }

      yield {
        type: 'status',
        data: {
          phase: 'implement',
          message: isRetry
            ? `Starting Phase 1: Implementation (Iteration #${reviewIteration})...`
            : 'Starting Phase 1: Implementation...'
        }
      }

      // Resolve capabilities for implement phase
      const implementOptions = resolveCapabilitiesForPhase(preset, 'implement', capabilityOverrides)

      for await (const event of runImplementPhase({
        mission,
        projectPath,
        feedback: retry?.feedback,
        retryCount: retry?.retryCount,
        queryOptions: implementOptions
      })) {
        yield event

        // If implementation failed, stop
        if (event.type === 'error') {
          return
        }
      }

      yield {
        type: 'implement_done',
        data: {
          commitHash: await getLastCommitHash(projectPath),
          message: 'Implementation complete',
          filesCreated: [],
          filesModified: []
        }
      }
    }

    // ========================================================================
    // Phase 2: Testing (formerly Polish)
    // ========================================================================
    yield {
      type: 'phase',
      data: { phase: 'testing', mission }
    }

    yield {
      type: 'status',
      data: {
        phase: 'testing',
        message: currentPhase === 'testing' && reviewIteration > 1
          ? `Starting Phase 2: Testing (Iteration #${reviewIteration})...`
          : 'Starting Phase 2: Testing...'
      }
    }

    // Resolve capabilities for testing phase (use 'testing' or fallback to 'polish')
    const testingOptions = resolveCapabilitiesForPhase(preset, 'testing', capabilityOverrides)

    let testingResult: TestingLoopResult = { finalScore: 0, totalCommits: 0, iterations: 0 }
    const testingGen = runTestingLoop(config, testingOptions)

    // Iterate through the generator, yielding events and capturing the final return value
    let testingIterResult = await testingGen.next()
    while (!testingIterResult.done) {
      const event = testingIterResult.value

      // Capture score events
      if (event.type === 'init') {
        state.initialScore = event.data.initialScore
      }
      if (event.type === 'score') {
        state.finalScore = event.data.score
      }
      if (event.type === 'commit') {
        state.commits.push({
          hash: event.data.hash,
          message: event.data.message,
          scoreDelta: event.data.scoreDelta,
          timestamp: new Date()
        })
      }

      yield event
      testingIterResult = await testingGen.next()
    }

    // The final value is the return value of the generator
    if (testingIterResult.value) {
      testingResult = testingIterResult.value
      state.finalScore = testingResult.finalScore
      state.iterations += testingResult.iterations
    }

    // ========================================================================
    // Phase 3: Review (Strict Code Review)
    // ========================================================================
    if (!mission) {
      // No mission = no review needed, just testing
      yield* generateAndYieldSummary({
        mission,
        initialScore: state.initialScore,
        finalScore: state.finalScore,
        commits: state.commits,
        duration: Date.now(),
        iterations: state.iterations,
        stoppedReason: testingResult.stoppedReason,
        reviewIterations: state.reviewIterations
      })
      return
    }

    yield {
      type: 'phase',
      data: { phase: 'review', mission }
    }

    yield {
      type: 'status',
      data: {
        phase: 'review',
        message: `Starting Phase 3: Code Review (Iteration #${reviewIteration})...`
      }
    }

    // Resolve capabilities for review phase
    const reviewOptions = resolveCapabilitiesForPhase(preset, 'review', capabilityOverrides)

    const reviewContext: ReviewContext = {
      projectPath,
      mission,
      config: effectiveReviewConfig,
      iteration: reviewIteration
    }

    let reviewResult: ReviewPhaseResult | null = null
    const reviewGen = runReviewPhase({ context: reviewContext, queryOptions: reviewOptions })

    // Iterate through the generator, yielding events and capturing the final return value
    let reviewIterResult = await reviewGen.next()
    while (!reviewIterResult.done) {
      yield reviewIterResult.value
      reviewIterResult = await reviewGen.next()
    }

    // The final value is the return value of the generator
    if (reviewIterResult.value) {
      reviewResult = reviewIterResult.value
    }

    // ========================================================================
    // Handle Review Verdict
    // ========================================================================
    if (!reviewResult) {
      yield {
        type: 'error',
        data: { message: 'Review phase failed to produce a result' }
      }
      return
    }

    // Check verdict
    if (reviewResult.finalVerdict === 'approved') {
      yield {
        type: 'status',
        data: {
          phase: 'complete',
          message: `All reviewers approved! Mission completed successfully after ${reviewIteration} review iteration(s).`
        }
      }
      yield* generateAndYieldSummary({
        mission,
        initialScore: state.initialScore,
        finalScore: state.finalScore,
        commits: state.commits,
        duration: Date.now(),
        iterations: state.iterations,
        stoppedReason: 'review_approved',
        reviewIterations: state.reviewIterations
      })
      return
    }

    if (reviewResult.finalVerdict === 'rejected') {
      yield {
        type: 'status',
        data: {
          phase: 'complete',
          message: 'Mission rejected by reviewers. The implementation has fundamental issues.'
        }
      }
      yield {
        type: 'error',
        data: {
          message: `Review rejected: ${reviewResult.mustFixItems.join(', ')}`
        }
      }
      return
    }

    // Handle needs_implementation or needs_testing
    if (reviewResult.returnToPhase && effectiveReviewConfig.autoRetry !== false) {
      currentPhase = reviewResult.returnToPhase

      yield {
        type: 'review_iteration',
        data: {
          iteration: reviewIteration,
          totalIterations: maxReviewIterations,
          returnToPhase: reviewResult.returnToPhase,
          feedback: reviewResult.feedbackForNextPhase || ''
        }
      }

      yield {
        type: 'status',
        data: {
          phase: 'review',
          message: `Reviewers request changes. Returning to ${currentPhase} phase (${reviewIteration}/${maxReviewIterations})...`
        }
      }

      // Update config with review feedback for next iteration
      if (reviewResult.feedbackForNextPhase) {
        config.retry = {
          feedback: reviewResult.feedbackForNextPhase,
          retryCount: reviewIteration,
          fromPhase: currentPhase
        }
      }

      // Continue loop to retry
      continue
    }

    // Auto-retry disabled or no return phase specified
    yield {
      type: 'status',
      data: {
        phase: 'complete',
        message: `Review completed with verdict: ${reviewResult.finalVerdict}. Auto-retry disabled.`
      }
    }
    break
  }

  // Max review iterations reached
  if (reviewIteration >= maxReviewIterations) {
    yield {
      type: 'status',
      data: {
        phase: 'complete',
        message: `Maximum review iterations (${maxReviewIterations}) reached. Please review manually.`
      }
    }
  }

  yield* generateAndYieldSummary({
    mission,
    initialScore: state.initialScore,
    finalScore: state.finalScore,
    commits: state.commits,
    duration: Date.now(),
    iterations: state.iterations,
    stoppedReason: 'max_review_iterations',
    reviewIterations: state.reviewIterations
  })
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
