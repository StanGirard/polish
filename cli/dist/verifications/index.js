import { loadVerifications } from './loader.js';
import { evaluateConditions } from './conditions.js';
let cachedVerifications = null;
/**
 * Get all verifications (cached)
 */
export function getAllVerifications() {
    if (!cachedVerifications) {
        cachedVerifications = loadVerifications();
    }
    return cachedVerifications;
}
/**
 * Get verifications that match the current project
 */
export async function getMatchingVerifications(cwd = process.cwd()) {
    const all = getAllVerifications();
    const matching = [];
    for (const verification of all) {
        if (verification.conditions.length === 0) {
            // No conditions means always match
            matching.push(verification);
        }
        else if (await evaluateConditions(verification.conditions, cwd)) {
            matching.push(verification);
        }
    }
    return matching;
}
/**
 * Get a verification by ID
 */
export function getVerification(id) {
    return getAllVerifications().find(v => v.id === id);
}
/**
 * Convert verification to metric for polish.config.json
 */
export function verificationToMetric(verification) {
    const metric = {
        name: verification.id,
        command: verification.command,
        weight: verification.weight,
        target: verification.target,
    };
    // Convert scoring config if not binary
    if (verification.scoring.type === 'regex') {
        metric.scoring = {
            type: 'custom',
            pattern: verification.scoring.pattern,
        };
    }
    return metric;
}
/**
 * Clear cached verifications (for testing)
 */
export function clearCache() {
    cachedVerifications = null;
}
