import { exec as execCallback } from 'child_process';
import { promisify } from 'util';
const exec = promisify(execCallback);
/**
 * Run a single metric and return its score
 */
export async function runMetric(metric) {
    try {
        const { stdout, stderr } = await exec(metric.command, {
            timeout: 300000, // 5 minutes max
            maxBuffer: 10 * 1024 * 1024, // 10MB
        });
        const output = stdout + stderr;
        const score = parseMetricOutput(metric, output, 0);
        return {
            name: metric.name,
            score,
            target: metric.target,
            weight: metric.weight,
            raw: output,
        };
    }
    catch (error) {
        // Command failed (non-zero exit code)
        const execError = error;
        const output = (execError.stdout || '') + (execError.stderr || '');
        const exitCode = execError.code || 1;
        const score = parseMetricOutput(metric, output, exitCode);
        return {
            name: metric.name,
            score,
            target: metric.target,
            weight: metric.weight,
            raw: output,
        };
    }
}
/**
 * Parse metric output to extract score (0-100)
 */
function parseMetricOutput(metric, output, exitCode) {
    const name = metric.name.toLowerCase();
    // Tests: parse pass/fail counts
    if (name === 'tests' || name === 'test') {
        return parseTestOutput(output, exitCode);
    }
    // TypeScript: count errors
    if (name === 'typescript' || name === 'tsc') {
        return parseTypeScriptOutput(output, exitCode);
    }
    // Lint: count errors/warnings
    if (name === 'lint' || name === 'eslint') {
        return parseLintOutput(output, exitCode);
    }
    // Coverage: extract percentage
    if (name === 'coverage') {
        return parseCoverageOutput(output);
    }
    // Default: binary pass/fail based on exit code
    return exitCode === 0 ? 100 : 0;
}
/**
 * Parse test runner output (bun test, jest, vitest, etc.)
 */
function parseTestOutput(output, exitCode) {
    // Bun test format: "123 pass, 5 fail"
    const bunMatch = output.match(/(\d+)\s+pass.*?(\d+)\s+fail/i);
    if (bunMatch) {
        const passed = parseInt(bunMatch[1], 10);
        const failed = parseInt(bunMatch[2], 10);
        const total = passed + failed;
        return total > 0 ? Math.round((passed / total) * 100) : 0;
    }
    // Jest/Vitest format: "Tests: 5 passed, 2 failed, 7 total"
    const jestMatch = output.match(/Tests?:\s*(\d+)\s+passed.*?(\d+)\s+failed/i);
    if (jestMatch) {
        const passed = parseInt(jestMatch[1], 10);
        const failed = parseInt(jestMatch[2], 10);
        const total = passed + failed;
        return total > 0 ? Math.round((passed / total) * 100) : 0;
    }
    // All passed format: "Tests: 10 passed, 10 total" or "10 pass"
    const allPassedMatch = output.match(/(\d+)\s+pass(?:ed)?/i);
    if (allPassedMatch && !output.match(/fail/i)) {
        return 100;
    }
    // Fallback to exit code
    return exitCode === 0 ? 100 : 0;
}
/**
 * Parse TypeScript compiler output
 */
function parseTypeScriptOutput(output, exitCode) {
    if (exitCode === 0)
        return 100;
    // Count errors: "error TS2345:"
    const errorMatches = output.match(/error TS\d+:/g);
    const errorCount = errorMatches?.length || 0;
    // Score decreases with more errors (max 20 errors = 0%)
    return Math.max(0, 100 - errorCount * 5);
}
/**
 * Parse ESLint output
 */
function parseLintOutput(output, exitCode) {
    if (exitCode === 0)
        return 100;
    // Count problems: "X problems (Y errors, Z warnings)"
    const problemsMatch = output.match(/(\d+)\s+problems?\s*\((\d+)\s+errors?,\s*(\d+)\s+warnings?\)/i);
    if (problemsMatch) {
        const errors = parseInt(problemsMatch[2], 10);
        const warnings = parseInt(problemsMatch[3], 10);
        // Errors count more than warnings
        const penalty = errors * 5 + warnings * 1;
        return Math.max(0, 100 - penalty);
    }
    // Simple error count
    const errorMatches = output.match(/\d+:\d+\s+error/g);
    const errorCount = errorMatches?.length || 0;
    return Math.max(0, 100 - errorCount * 5);
}
/**
 * Parse coverage output
 */
function parseCoverageOutput(output) {
    // "All files | 85.5% | ..."
    const coverageMatch = output.match(/All files\s*\|\s*(\d+(?:\.\d+)?)\s*%/i);
    if (coverageMatch) {
        return Math.round(parseFloat(coverageMatch[1]));
    }
    // "Coverage: 85.5%"
    const simpleMatch = output.match(/coverage[:\s]+(\d+(?:\.\d+)?)\s*%/i);
    if (simpleMatch) {
        return Math.round(parseFloat(simpleMatch[1]));
    }
    return 0;
}
/**
 * Calculate total score from all metrics
 */
export async function calculateScore(metrics) {
    const results = [];
    for (const metric of metrics) {
        const result = await runMetric(metric);
        results.push(result);
    }
    // Calculate weighted average
    const totalWeight = results.reduce((sum, r) => sum + r.weight, 0);
    const weightedSum = results.reduce((sum, r) => sum + r.score * r.weight, 0);
    const total = totalWeight > 0 ? weightedSum / totalWeight : 0;
    return {
        total: Math.round(total * 10) / 10, // 1 decimal place
        metrics: results,
    };
}
/**
 * Find the worst performing metric
 */
export function findWorstMetric(score) {
    let worst = score.metrics[0];
    let worstGap = worst.target - worst.score;
    for (const metric of score.metrics) {
        const gap = metric.target - metric.score;
        if (gap > worstGap) {
            worst = metric;
            worstGap = gap;
        }
    }
    return worst;
}
