import chalk from 'chalk';
import { runAgent, runAgentWithCallback } from './agent.js';
import { calculateScore, findWorstMetric } from './metrics.js';
import { gitSnapshot, gitRollback, gitCommit, hasUncommittedChanges } from './git.js';
import type { PolishConfig, PolishResult, ScoreResult, Provider } from './types.js';

const MIN_IMPROVEMENT = 0.5; // Minimum score improvement to commit
const MAX_STALLED = 5; // Max consecutive failures before stopping

/**
 * Format score for display
 */
function formatScore(score: ScoreResult): string {
  const total = score.total >= 95
    ? chalk.green(score.total.toFixed(1))
    : score.total >= 80
      ? chalk.yellow(score.total.toFixed(1))
      : chalk.red(score.total.toFixed(1));

  const metrics = score.metrics
    .map((m) => `${m.name}: ${m.score}%`)
    .join(', ');

  return `${total}/100 (${metrics})`;
}

export interface PolishLoopCallbacks {
  onScore?: (score: ScoreResult) => void;
  onIteration?: (iteration: number) => void;
  onImproving?: (metricName: string | null) => void;
  onAgentText?: (text: string) => void;
  onAgentTool?: (tool: string) => void;
  onAgentToolDone?: () => void;
  onCommit?: (hash: string) => void;
  onRollback?: () => void;
}

/**
 * Run the polish loop to iteratively improve code quality
 */
export async function runPolishLoop(config: PolishConfig): Promise<PolishResult> {
  return runPolishLoopWithCallback(config, {});
}

/**
 * Run the polish loop with callbacks for UI integration
 */
export async function runPolishLoopWithCallback(
  config: PolishConfig,
  callbacks: PolishLoopCallbacks
): Promise<PolishResult> {
  const {
    onScore,
    onIteration,
    onImproving,
    onAgentText,
    onAgentTool,
    onAgentToolDone,
    onCommit,
    onRollback,
  } = callbacks;

  const commits: string[] = [];
  let stalledCount = 0;

  // Calculate initial score
  const initialScore = await calculateScore(config.metrics);
  onScore?.(initialScore);

  let currentScore = initialScore;

  for (let iteration = 1; iteration <= config.maxIterations; iteration++) {
    onIteration?.(iteration);

    // Check if target reached
    if (currentScore.total >= config.target) {
      return {
        initialScore,
        finalScore: currentScore,
        iterations: iteration - 1,
        commits,
        reason: 'target_reached',
      };
    }

    // Check for plateau
    if (stalledCount >= MAX_STALLED) {
      return {
        initialScore,
        finalScore: currentScore,
        iterations: iteration - 1,
        commits,
        reason: 'plateau',
      };
    }

    // Find worst metric to improve
    const worst = findWorstMetric(currentScore);
    onImproving?.(worst.name);

    // Create snapshot before changes
    const snapshot = await gitSnapshot();

    // Build prompt for Claude
    const prompt = buildPolishPrompt(worst.name, worst.score, worst.target, worst.raw);

    try {
      // Run Claude agent to make improvements
      await runAgentWithCallback(prompt, {
        onText: onAgentText,
        onTool: onAgentTool,
        onToolDone: onAgentToolDone,
      }, { maxTokens: 8192, provider: config.provider });

      // Check if there are any changes
      if (!(await hasUncommittedChanges())) {
        stalledCount++;
        continue;
      }

      // Calculate new score
      onImproving?.(null);
      const newScore = await calculateScore(config.metrics);
      const improvement = newScore.total - currentScore.total;

      // Check if improvement is significant
      if (improvement >= MIN_IMPROVEMENT) {
        // Commit the changes
        const message = `polish(${worst.name}): ${currentScore.total.toFixed(1)} → ${newScore.total.toFixed(1)}`;
        const hash = await gitCommit(message);
        commits.push(hash);

        onCommit?.(hash);
        onScore?.(newScore);

        currentScore = newScore;
        stalledCount = 0;
      } else {
        // Rollback changes
        await gitRollback(snapshot);
        onRollback?.();
        stalledCount++;
      }
    } catch (error) {
      await gitRollback(snapshot);
      onRollback?.();
      stalledCount++;
    }
  }

  return {
    initialScore,
    finalScore: currentScore,
    iterations: config.maxIterations,
    commits,
    reason: 'max_iterations',
  };
}

/**
 * Build a prompt for improving a specific metric
 */
function buildPolishPrompt(
  metricName: string,
  currentScore: number,
  targetScore: number,
  rawOutput?: string
): string {
  const context = rawOutput
    ? `\nCurrent output:\n\`\`\`\n${rawOutput.slice(0, 2000)}\n\`\`\``
    : '';

  switch (metricName.toLowerCase()) {
    case 'tests':
    case 'test':
      return `The test suite is at ${currentScore}% (target: ${targetScore}%).

Your task: Fix failing tests or add missing tests to improve the score.
${context}

Focus on:
1. Read the failing test output to understand what's broken
2. Find and fix the root cause in the implementation
3. Make minimal, targeted changes
4. Do NOT delete or skip tests`;

    case 'typescript':
    case 'tsc':
      return `TypeScript compilation has errors (score: ${currentScore}%, target: ${targetScore}%).

Your task: Fix TypeScript errors to improve the score.
${context}

Focus on:
1. Read the error messages carefully
2. Fix type errors with proper types (avoid 'any' when possible)
3. Make minimal changes to fix each error`;

    case 'lint':
    case 'eslint':
      return `ESLint has errors (score: ${currentScore}%, target: ${targetScore}%).

Your task: Fix linting errors to improve the score.
${context}

Focus on:
1. Fix each error according to the rule
2. Do NOT disable rules unless absolutely necessary
3. Make minimal, targeted changes`;

    case 'coverage':
      return `Test coverage is at ${currentScore}% (target: ${targetScore}%).

Your task: Add tests to improve coverage.
${context}

Focus on:
1. Identify uncovered code paths
2. Add meaningful tests (not just coverage padding)
3. Test edge cases and error paths`;

    default:
      return `The metric "${metricName}" is at ${currentScore}% (target: ${targetScore}%).

Your task: Improve this metric by making appropriate code changes.
${context}

Make minimal, targeted changes to improve the score.`;
  }
}

/**
 * Display final results
 */
export function displayResults(result: PolishResult): void {
  console.log(chalk.bold('\n--- Results ---\n'));

  const improvement = result.finalScore.total - result.initialScore.total;
  const improvementStr = improvement >= 0
    ? chalk.green(`+${improvement.toFixed(1)}`)
    : chalk.red(improvement.toFixed(1));

  console.log(`Initial score: ${formatScore(result.initialScore)}`);
  console.log(`Final score:   ${formatScore(result.finalScore)}`);
  console.log(`Improvement:   ${improvementStr}`);
  console.log(`Iterations:    ${result.iterations}`);
  console.log(`Commits:       ${result.commits.length}`);
  console.log(`Reason:        ${result.reason}`);

  if (result.commits.length > 0) {
    console.log(`\nCommits made:`);
    for (const hash of result.commits) {
      console.log(`  ${hash}`);
    }
  }
}
