import { writeFile, readFile, readdir, stat } from 'fs/promises'
import { join, dirname } from 'path'
import { mkdir } from 'fs/promises'
import type { Config, JobState, JobResult, Failure, ScoreResult } from './types'
import { calculateScore, selectStrategy } from './scorer'
import { prompt, parseResponse, buildPrompt, getTotalTokensUsed, resetTokenCount, estimateCost } from './llm'
import { commit, rollback, push, createPR } from './git'
import { exec } from './executor'

interface LoopOptions {
  duration: number // seconds
  onProgress?: (state: JobState) => void
  githubToken: string
  repoUrl: string
}

async function applyFileChanges(
  projectPath: string,
  files: { path: string; content: string }[]
): Promise<void> {
  for (const file of files) {
    // Normalize path - remove leading slash if present
    const normalizedPath = file.path.startsWith('/') ? file.path.slice(1) : file.path
    const fullPath = join(projectPath, normalizedPath)

    // Ensure directory exists
    await mkdir(dirname(fullPath), { recursive: true })

    // Write file
    await writeFile(fullPath, file.content, 'utf-8')
  }
}

async function runTests(projectPath: string): Promise<boolean> {
  // Try to run tests if they exist
  const result = await exec('npm test -- --passWithNoTests 2>&1 || true', projectPath, 120000)

  // Check for test failures in output
  const output = result.stdout + result.stderr
  if (output.includes('FAIL') || output.includes('failed')) {
    return false
  }

  return true
}

async function getRelevantFiles(projectPath: string, maxFiles: number = 20): Promise<Record<string, string>> {
  const files: Record<string, string> = {}

  async function scanDir(dir: string, depth: number = 0): Promise<void> {
    if (depth > 3 || Object.keys(files).length >= maxFiles) return

    const entries = await readdir(dir, { withFileTypes: true })

    for (const entry of entries) {
      if (Object.keys(files).length >= maxFiles) break

      // Skip common non-source directories
      if (['node_modules', '.git', '.next', 'dist', 'build', 'coverage'].includes(entry.name)) {
        continue
      }

      const fullPath = join(dir, entry.name)
      const relativePath = fullPath.replace(projectPath + '/', '')

      if (entry.isDirectory()) {
        await scanDir(fullPath, depth + 1)
      } else if (entry.isFile()) {
        // Only include source files
        if (/\.(ts|tsx|js|jsx|json)$/.test(entry.name) && !entry.name.includes('.d.ts')) {
          try {
            const fileStat = await stat(fullPath)
            // Skip large files
            if (fileStat.size < 50000) {
              const content = await readFile(fullPath, 'utf-8')
              files[relativePath] = content
            }
          } catch {
            // Skip files we can't read
          }
        }
      }
    }
  }

  await scanDir(projectPath)
  return files
}

export async function runPolishLoop(
  projectPath: string,
  config: Config,
  options: LoopOptions
): Promise<JobResult> {
  const { duration, onProgress, githubToken, repoUrl } = options

  resetTokenCount()

  const state: JobState = {
    repo: repoUrl,
    branch: `polish/auto-${Date.now()}`,
    iteration: 0,
    scoreHistory: [],
    currentStrategyIndex: 0,
    stalledCount: 0,
    failures: [],
    commits: [],
    startedAt: new Date(),
    duration: 0,
  }

  const startTime = Date.now()
  const endTime = startTime + duration * 1000

  // Calculate initial score
  console.log('Calculating initial score...')
  const initialScore = await calculateScore(config, projectPath)
  state.scoreHistory.push(initialScore.total)

  const notify = () => {
    state.duration = (Date.now() - startTime) / 1000
    onProgress?.(state)
  }

  notify()

  // Track global stall - if all strategies stall without any improvement
  let globalStalledCount = 0
  const maxGlobalStalled = config.strategies.length * config.thresholds.maxStalled

  // Main loop
  while (Date.now() < endTime && initialScore.total < config.thresholds.maxScore) {
    state.iteration++

    // Check global stall
    if (globalStalledCount >= maxGlobalStalled) {
      console.log('All strategies exhausted without progress. Stopping.')
      break
    }

    // Select strategy based on worst metric
    const currentScore = state.scoreHistory.length > 0
      ? {
          total: state.scoreHistory[state.scoreHistory.length - 1],
          details: initialScore.details,
          diagnostics: initialScore.diagnostics,
          values: initialScore.values
        }
      : initialScore

    const strategyResult = selectStrategy(currentScore, config, state.currentStrategyIndex)
    if (!strategyResult) {
      console.log('No strategies available. Stopping.')
      break
    }

    const { strategy, index } = strategyResult
    state.currentStrategyIndex = index

    console.log(`\n=== Iteration ${state.iteration} ===`)
    console.log(`Strategy: ${strategy.name} (targeting ${strategy.focus})`)
    console.log(`Current score: ${currentScore.total.toFixed(1)}`)

    notify()

    try {
      // Get relevant project files for context
      const fileContents = await getRelevantFiles(projectPath)

      // Build and send prompt
      const messages = buildPrompt(
        config,
        currentScore,
        state.failures.slice(-5),
        strategy,
        fileContents
      )

      console.log('Calling LLM...')
      const response = await prompt(messages)
      const parsed = parseResponse(response)

      if (parsed.skip) {
        console.log('LLM returned SKIP - no changes for this strategy')
        state.stalledCount++
        globalStalledCount++

        if (state.stalledCount >= config.thresholds.maxStalled) {
          console.log('Strategy stalled, rotating...')
          state.currentStrategyIndex = (state.currentStrategyIndex + 1) % config.strategies.length
          state.stalledCount = 0
        }
        continue
      }

      if (parsed.files.length === 0) {
        console.log('No file changes in response')
        state.stalledCount++
        globalStalledCount++
        continue
      }

      // Apply changes
      console.log(`Applying ${parsed.files.length} file change(s)...`)
      await applyFileChanges(projectPath, parsed.files)

      // Run tests
      console.log('Running tests...')
      const testsPass = await runTests(projectPath)

      if (!testsPass) {
        console.log('Tests failed, rolling back...')
        await rollback(projectPath)

        const failure: Failure = {
          iteration: state.iteration,
          strategy: strategy.name,
          target: strategy.focus,
          reason: 'tests_failed',
        }
        state.failures.push(failure)
        state.stalledCount++
        globalStalledCount++
        continue
      }

      // Calculate new score
      console.log('Calculating new score...')
      const newScore = await calculateScore(config, projectPath)
      const improvement = newScore.total - currentScore.total

      console.log(`Score: ${currentScore.total.toFixed(1)} -> ${newScore.total.toFixed(1)} (${improvement >= 0 ? '+' : ''}${improvement.toFixed(2)})`)

      if (improvement >= config.thresholds.minImprovement) {
        // Commit the changes
        const commitMessage = `polish: ${strategy.name} - ${parsed.explanation.slice(0, 50)}`
        console.log(`Committing: ${commitMessage}`)
        const sha = await commit(projectPath, commitMessage)

        state.commits.push(sha)
        state.scoreHistory.push(newScore.total)
        state.stalledCount = 0
        globalStalledCount = 0 // Reset global stall on success

        // Update current score details for next iteration
        Object.assign(initialScore.details, newScore.details)
        Object.assign(initialScore.diagnostics, newScore.diagnostics)
        Object.assign(initialScore.values, newScore.values)

        // Check if we reached max score
        if (newScore.total >= config.thresholds.maxScore) {
          console.log('Max score reached!')
          break
        }
      } else {
        console.log('Improvement below threshold, rolling back...')
        await rollback(projectPath)

        const failure: Failure = {
          iteration: state.iteration,
          strategy: strategy.name,
          target: strategy.focus,
          reason: 'no_improvement',
        }
        state.failures.push(failure)
        state.stalledCount++
        globalStalledCount++

        if (state.stalledCount >= config.thresholds.maxStalled) {
          console.log('Strategy stalled, rotating...')
          state.currentStrategyIndex = (state.currentStrategyIndex + 1) % config.strategies.length
          state.stalledCount = 0
        }
      }

    } catch (error) {
      console.error(`Error in iteration ${state.iteration}:`, error)

      // Rollback any partial changes
      await rollback(projectPath).catch(() => {})

      const failure: Failure = {
        iteration: state.iteration,
        strategy: strategy.name,
        target: strategy.focus,
        reason: 'error',
        error: error instanceof Error ? error.message : String(error),
      }
      state.failures.push(failure)
      state.stalledCount++
      globalStalledCount++
    }

    notify()
  }

  // Final operations
  const finalScore = state.scoreHistory.length > 0
    ? state.scoreHistory[state.scoreHistory.length - 1]
    : initialScore.total

  const scoreBefore = state.scoreHistory[0] || initialScore.total

  let prUrl: string | undefined

  // Push and create PR if we have commits
  if (state.commits.length > 0) {
    console.log('\nPushing changes...')
    try {
      await push(projectPath, state.branch, githubToken)

      console.log('Creating PR...')
      const prBody = `## Polish Auto-Improvement

### Results
- **Score Before**: ${scoreBefore.toFixed(1)}/100
- **Score After**: ${finalScore.toFixed(1)}/100
- **Improvement**: +${(finalScore - scoreBefore).toFixed(1)}
- **Iterations**: ${state.iteration}
- **Commits**: ${state.commits.length}
- **Duration**: ${((Date.now() - startTime) / 1000 / 60).toFixed(1)} minutes

### Commits
${state.commits.map((sha, i) => `- ${sha.slice(0, 7)}`).join('\n')}

---
*Generated by [Polish](https://github.com/polish-dev/polish)*`

      prUrl = await createPR(
        repoUrl,
        state.branch,
        `polish: Improve code quality (+${(finalScore - scoreBefore).toFixed(1)} points)`,
        prBody,
        githubToken
      )
      console.log(`PR created: ${prUrl}`)
    } catch (error) {
      console.error('Failed to push/create PR:', error)
    }
  }

  const durationSeconds = (Date.now() - startTime) / 1000
  const tokensUsed = getTotalTokensUsed()

  return {
    scoreBefore,
    scoreAfter: finalScore,
    iterations: state.iteration,
    commits: state.commits,
    prUrl,
    durationSeconds,
    costEstimate: estimateCost(tokensUsed),
  }
}
