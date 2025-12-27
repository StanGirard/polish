import * as fs from 'fs/promises';
import * as path from 'path';
const STATE_FILE = '.polish/state.json';
const MIN_IMPROVEMENT = 0.5;
/**
 * Get the path to the state file
 */
export function getStatePath(cwd = process.cwd()) {
    return path.join(cwd, STATE_FILE);
}
/**
 * Load state from disk, or create initial state
 */
export async function loadState(cwd = process.cwd()) {
    const statePath = getStatePath(cwd);
    try {
        const content = await fs.readFile(statePath, 'utf-8');
        return JSON.parse(content);
    }
    catch {
        // No state file - create initial state
        return createInitialState();
    }
}
/**
 * Create initial state for a new polish session
 */
export function createInitialState() {
    const now = new Date().toISOString();
    return {
        iteration: 0,
        scores: [],
        lastImprovement: 0,
        stalledCount: 0,
        worktreePath: null,
        startedAt: now,
        lastUpdated: now,
    };
}
/**
 * Save state to disk
 */
export async function saveState(state, cwd = process.cwd()) {
    const statePath = getStatePath(cwd);
    // Ensure .polish directory exists
    const dir = path.dirname(statePath);
    await fs.mkdir(dir, { recursive: true });
    // Update timestamp
    state.lastUpdated = new Date().toISOString();
    await fs.writeFile(statePath, JSON.stringify(state, null, 2));
}
/**
 * Reset state (clear the file)
 */
export async function resetState(cwd = process.cwd()) {
    const statePath = getStatePath(cwd);
    try {
        await fs.unlink(statePath);
    }
    catch {
        // File doesn't exist, that's fine
    }
}
/**
 * Update state with new score and return whether we improved
 */
export function updateStateWithScore(state, score) {
    const previousScore = state.scores.length > 0 ? state.scores[state.scores.length - 1] : 0;
    const improved = score.total - previousScore >= MIN_IMPROVEMENT;
    state.iteration++;
    state.scores.push(score.total);
    if (improved) {
        state.lastImprovement = state.iteration;
        state.stalledCount = 0;
    }
    else {
        state.stalledCount++;
    }
    return improved;
}
/**
 * Get the previous score from state
 */
export function getPreviousScore(state) {
    return state.scores.length > 0 ? state.scores[state.scores.length - 1] : 0;
}
/**
 * Check if we have initial score recorded
 */
export function hasInitialScore(state) {
    return state.scores.length > 0;
}
