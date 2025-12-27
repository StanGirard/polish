#!/usr/bin/env node
/**
 * Polish Stop Hook for Claude Code
 *
 * This script is called by Claude Code when the agent wants to stop.
 * It runs metrics, checks if target is reached, and decides whether
 * Claude should continue or stop.
 *
 * Input (stdin): JSON with session info including stop_hook_active
 * Output (stdout): JSON with { decision: "block" | "approve", reason: string }
 *
 * Exit codes:
 * - 0: Success (check stdout for decision)
 * - 2: Blocking error
 */

import * as fs from 'fs';
import * as path from 'path';
import { loadConfig } from './config.js';
import { calculateScore, findWorstMetric } from './metrics.js';
import { gitCommit, hasUncommittedChanges } from './git.js';
import {
  loadState,
  saveState,
  updateStateWithScore,
  getPreviousScore,
  hasInitialScore,
  createInitialState,
} from './state.js';
import { detectPlateau, type PlateauDetectionMode } from './plateau.js';

/**
 * Simple file logger for hook invocations
 */
function log(message: string): void {
  const logDir = path.join(process.cwd(), '.polish');
  const logFile = path.join(logDir, 'hook.log');
  const timestamp = new Date().toISOString();
  const logLine = `[${timestamp}] ${message}\n`;

  try {
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
    fs.appendFileSync(logFile, logLine);
  } catch {
    // Silently ignore logging errors - don't disrupt hook operation
  }
}

interface HookInput {
  session_id: string;
  transcript_path: string;
  cwd: string;
  hook_event_name: string;
  stop_hook_active?: boolean;
}

interface HookOutput {
  decision: 'block' | 'approve';
  reason: string;
}

/**
 * Build feedback prompt for Claude based on metric results
 */
function buildFeedbackPrompt(
  worstMetric: { name: string; score: number; target: number; raw?: string },
  currentScore: number,
  target: number
): string {
  const gap = target - currentScore;
  const metricGap = worstMetric.target - worstMetric.score;

  let prompt = `The code still needs improvement. Current score: ${currentScore}/${target} (${gap.toFixed(1)} points to go).\n\n`;
  prompt += `The worst performing metric is "${worstMetric.name}" with score ${worstMetric.score}/${worstMetric.target} (${metricGap.toFixed(1)} points gap).\n\n`;

  if (worstMetric.raw) {
    prompt += `Here is the output from running the ${worstMetric.name} check:\n\n`;
    prompt += '```\n';
    // Truncate if too long
    const maxLength = 4000;
    if (worstMetric.raw.length > maxLength) {
      prompt += worstMetric.raw.slice(0, maxLength) + '\n... (truncated)\n';
    } else {
      prompt += worstMetric.raw;
    }
    prompt += '```\n\n';
  }

  prompt += `Please fix the issues in "${worstMetric.name}" to improve the score.\n\n`;
  prompt += `IMPORTANT: You must continue working until all metrics reach their targets. `;
  prompt += `Analyze the output above, identify the root cause, and fix it. `;
  prompt += `DO NOT stop until the score reaches ${target} or above.`;

  return prompt;
}

async function main(): Promise<void> {
  log('Hook invoked');

  // Read input from stdin
  let input: HookInput;
  try {
    const stdin = await readStdin();
    input = JSON.parse(stdin) as HookInput;
    log(`Input: session_id=${input.session_id}, hook_event=${input.hook_event_name}, stop_hook_active=${input.stop_hook_active}`);
  } catch {
    // No stdin or invalid JSON - might be running manually
    input = {
      session_id: 'manual',
      transcript_path: '',
      cwd: process.cwd(),
      hook_event_name: 'Stop',
    };
    log('No stdin input - running in manual mode');
  }

  // CRITICAL: Check stop_hook_active to prevent infinite loops
  // If true, we're already in a hook-driven continuation - allow stop
  if (input.stop_hook_active) {
    log('stop_hook_active=true - approving to prevent infinite loop');
    const output: HookOutput = {
      decision: 'approve',
      reason: 'Stop hook already active - allowing stop to prevent infinite loop',
    };
    console.log(JSON.stringify(output));
    process.exit(0);
  }

  // Load config and state
  const config = loadConfig();
  let state = await loadState();
  log(`Config loaded: target=${config.target}, metrics=${config.metrics.map((m) => m.name).join(', ')}`);

  // Run metrics
  log('Running metrics...');
  const score = await calculateScore(config.metrics);
  log(`Metrics complete: total=${score.total.toFixed(1)}`)

  // If this is the first iteration, record initial score
  if (!hasInitialScore(state)) {
    state = createInitialState();
    state.scores.push(score.total);
    await saveState(state);
  }

  // Check if target reached
  if (score.total >= config.target) {
    log(`Target reached! score=${score.total} >= target=${config.target}`);
    // Commit any remaining changes before stopping
    if (await hasUncommittedChanges()) {
      const previousScore = getPreviousScore(state);
      await gitCommit(`polish: ${previousScore.toFixed(1)} -> ${score.total.toFixed(1)} (target reached)`);
    }

    const output: HookOutput = {
      decision: 'approve',
      reason: `Target reached! Score: ${score.total}/${config.target}`,
    };
    log(`Decision: approve (target reached)`);
    console.log(JSON.stringify(output));
    process.exit(0);
  }

  // Update state with new score
  const improved = updateStateWithScore(state, score);
  log(`Score update: improved=${improved}, stalledCount=${state.stalledCount}, iteration=${state.iteration}`);

  // If improved, commit the changes
  if (improved && (await hasUncommittedChanges())) {
    const previousScore = state.scores.length > 1 ? state.scores[state.scores.length - 2] : 0;
    const worstMetric = findWorstMetric(score);
    await gitCommit(`polish(${worstMetric.name}): ${previousScore.toFixed(1)} -> ${score.total.toFixed(1)}`);
    log(`Committed improvement: ${previousScore.toFixed(1)} -> ${score.total.toFixed(1)}`);
  }

  // Check for plateau
  const plateauMode: PlateauDetectionMode = 'stalled'; // Could be config.plateauDetection
  const plateauDecision = detectPlateau(state, score, config.target, plateauMode);

  if (plateauDecision.shouldStop) {
    log(`Plateau detected: ${plateauDecision.reason}`);
    await saveState(state);
    const output: HookOutput = {
      decision: 'approve',
      reason: plateauDecision.reason,
    };
    log(`Decision: approve (plateau)`);
    console.log(JSON.stringify(output));
    process.exit(0);
  }

  // Continue - find worst metric and build feedback
  const worstMetric = findWorstMetric(score);
  const feedbackPrompt = buildFeedbackPrompt(worstMetric, score.total, config.target);

  await saveState(state);

  const output: HookOutput = {
    decision: 'block',
    reason: feedbackPrompt,
  };
  log(`Decision: block (worst metric: ${worstMetric.name}=${worstMetric.score})`);
  console.log(JSON.stringify(output));
  process.exit(0);
}

/**
 * Read all stdin
 */
function readStdin(): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = '';

    // Check if stdin is a TTY (no piped input)
    if (process.stdin.isTTY) {
      resolve('{}');
      return;
    }

    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => {
      data += chunk;
    });
    process.stdin.on('end', () => {
      resolve(data);
    });
    process.stdin.on('error', reject);

    // Timeout after 1 second if no data
    setTimeout(() => {
      if (!data) {
        resolve('{}');
      }
    }, 1000);
  });
}

// Run the hook
main().catch((error) => {
  const errorMsg = error instanceof Error ? error.message : String(error);
  log(`Hook error: ${errorMsg}`);
  console.error('Polish hook error:', error);
  // On error, allow Claude to stop (don't block)
  const output: HookOutput = {
    decision: 'approve',
    reason: `Hook error: ${errorMsg}`,
  };
  log(`Decision: approve (error)`);
  console.log(JSON.stringify(output));
  process.exit(0);
});
