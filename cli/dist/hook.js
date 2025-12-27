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
import { loadConfig, ConfigNotFoundError } from './config.js';
import { calculateScore, findWorstMetric } from './metrics.js';
import { loadState, saveState, updateStateWithScore, hasInitialScore, createInitialState, } from './state.js';
import { detectPlateau } from './plateau.js';
/**
 * Simple file logger for hook invocations
 */
function log(message) {
    const logDir = path.join(process.cwd(), '.polish');
    const logFile = path.join(logDir, 'hook.log');
    const timestamp = new Date().toISOString();
    const logLine = `[${timestamp}] ${message}\n`;
    try {
        if (!fs.existsSync(logDir)) {
            fs.mkdirSync(logDir, { recursive: true });
        }
        fs.appendFileSync(logFile, logLine);
    }
    catch {
        // Silently ignore logging errors - don't disrupt hook operation
    }
}
/**
 * Build feedback prompt for Claude based on metric results
 */
function buildFeedbackPrompt(worstMetric, currentScore, target) {
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
        }
        else {
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
async function main() {
    log('Hook invoked');
    // Read input from stdin
    let input;
    try {
        const stdin = await readStdin();
        input = JSON.parse(stdin);
        log(`Input: session_id=${input.session_id}, hook_event=${input.hook_event_name}, stop_hook_active=${input.stop_hook_active}`);
    }
    catch {
        // No stdin or invalid JSON - might be running manually
        input = {
            session_id: 'manual',
            transcript_path: '',
            cwd: process.cwd(),
            hook_event_name: 'Stop',
        };
        log('No stdin input - running in manual mode');
    }
    // Note: We don't check stop_hook_active here anymore.
    // The plateau detection logic handles infinite loop prevention by
    // detecting when the score stops improving after multiple iterations.
    // Load config and state
    const config = loadConfig();
    let state = await loadState();
    log(`Config loaded: target=${config.target}, metrics=${config.metrics.map((m) => m.name).join(', ')}`);
    // Run metrics
    log('Running metrics...');
    const score = await calculateScore(config.metrics);
    log(`Metrics complete: total=${score.total.toFixed(1)}`);
    // If this is the first iteration, record initial score
    if (!hasInitialScore(state)) {
        state = createInitialState();
        state.scores.push(score.total);
        await saveState(state);
    }
    // Check if target reached
    if (score.total >= config.target) {
        log(`Target reached! score=${score.total} >= target=${config.target}`);
        const output = {
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
    // Log improvement (no auto-commit - let user decide when to commit)
    if (improved) {
        const previousScore = state.scores.length > 1 ? state.scores[state.scores.length - 2] : 0;
        log(`Score improved: ${previousScore.toFixed(1)} -> ${score.total.toFixed(1)}`);
    }
    // Check for plateau
    const plateauMode = 'stalled'; // Could be config.plateauDetection
    const plateauDecision = detectPlateau(state, score, config.target, plateauMode);
    if (plateauDecision.shouldStop) {
        log(`Plateau detected: ${plateauDecision.reason}`);
        await saveState(state);
        const output = {
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
    const output = {
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
function readStdin() {
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
    // For ConfigNotFoundError, provide a cleaner message
    if (error instanceof ConfigNotFoundError) {
        const output = {
            decision: 'approve',
            reason: 'No polish.config.json found. Create one to enable Polish metrics.',
        };
        log(`Decision: approve (no config)`);
        console.log(JSON.stringify(output));
        process.exit(0);
    }
    // On other errors, allow Claude to stop (don't block)
    console.error('Polish hook error:', error);
    const output = {
        decision: 'approve',
        reason: `Hook error: ${errorMsg}`,
    };
    log(`Decision: approve (error)`);
    console.log(JSON.stringify(output));
    process.exit(0);
});
