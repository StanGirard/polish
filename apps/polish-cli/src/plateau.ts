import type { PolishState } from './state.js';
import type { ScoreResult } from './types.js';

export interface PlateauDecision {
  shouldStop: boolean;
  reason: string;
}

export type PlateauDetectionMode = 'stalled' | 'llm';

const MAX_STALLED_COUNT = 5;

/**
 * Detect if we've hit a plateau and should stop
 *
 * 'stalled' mode: Simple counter-based detection
 * 'llm' mode: Uses LLM to make intelligent decision (via prompt-based hook)
 */
export function detectPlateau(
  state: PolishState,
  currentScore: ScoreResult,
  target: number,
  mode: PlateauDetectionMode = 'stalled'
): PlateauDecision {
  // Target reached - always stop
  if (currentScore.total >= target) {
    return {
      shouldStop: true,
      reason: `Target reached: ${currentScore.total} >= ${target}`,
    };
  }

  if (mode === 'stalled') {
    return detectPlateauStalled(state);
  }

  // LLM mode - we don't make the decision here
  // The hook will use type: "prompt" instead of type: "command"
  // So we return shouldStop: false and let the LLM decide
  return {
    shouldStop: false,
    reason: 'LLM mode - decision delegated to prompt-based hook',
  };
}

/**
 * Simple stalled counter detection
 */
function detectPlateauStalled(state: PolishState): PlateauDecision {
  if (state.stalledCount >= MAX_STALLED_COUNT) {
    return {
      shouldStop: true,
      reason: `Plateau detected: ${state.stalledCount} consecutive iterations without improvement`,
    };
  }

  return {
    shouldStop: false,
    reason: `Continuing: stalled ${state.stalledCount}/${MAX_STALLED_COUNT}`,
  };
}

/**
 * Build context for LLM-based plateau detection
 * This is used when the hook is configured with type: "prompt"
 */
export function buildPlateauContext(state: PolishState, currentScore: ScoreResult, target: number): string {
  const scoreHistory = state.scores.map((s, i) => `  Iteration ${i + 1}: ${s}`).join('\n');
  const metricBreakdown = currentScore.metrics
    .map((m) => `  ${m.name}: ${m.score}/${m.target} (weight: ${m.weight})`)
    .join('\n');

  return `
# Polish Session Status

## Current State
- Iteration: ${state.iteration}
- Target Score: ${target}
- Current Score: ${currentScore.total}
- Stalled Count: ${state.stalledCount}
- Last Improvement: Iteration ${state.lastImprovement}

## Score History
${scoreHistory || '  (no history yet)'}

## Current Metric Breakdown
${metricBreakdown}

## Question
Based on this information, should we continue trying to improve the code or stop?
Consider:
- Is there a clear trend of improvement?
- Have we been stuck on the same issues?
- Is the gap to target reasonable to close?

Respond with JSON:
{
  "decision": "continue" | "stop",
  "reason": "explanation"
}
`.trim();
}
