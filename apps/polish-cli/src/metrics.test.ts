import { describe, test, expect } from 'bun:test';
import { findWorstMetric, runMetric, calculateScore } from './metrics.js';
import type { ScoreResult, MetricResult, Metric } from './types.js';

describe('runMetric', () => {
  test('returns 100 score for successful command', async () => {
    const metric: Metric = {
      name: 'simple',
      command: 'echo "success"',
      weight: 100,
      target: 100,
    };

    const result = await runMetric(metric);

    expect(result.score).toBe(100);
    expect(result.name).toBe('simple');
    expect(result.weight).toBe(100);
    expect(result.target).toBe(100);
    expect(result.raw).toContain('success');
  });

  test('returns 0 score for failed command (non-zero exit)', async () => {
    const metric: Metric = {
      name: 'failing',
      command: 'exit 1',
      weight: 100,
      target: 100,
    };

    const result = await runMetric(metric);

    expect(result.score).toBe(0);
    expect(result.name).toBe('failing');
  });

  test('parses bun test output format', async () => {
    const metric: Metric = {
      name: 'tests',
      command: 'echo "8 pass, 2 fail"',
      weight: 100,
      target: 100,
    };

    const result = await runMetric(metric);

    expect(result.score).toBe(80); // 8/(8+2) = 80%
  });

  test('parses jest/vitest output format', async () => {
    const metric: Metric = {
      name: 'tests',
      command: 'echo "Tests: 15 passed, 5 failed, 20 total"',
      weight: 100,
      target: 100,
    };

    const result = await runMetric(metric);

    expect(result.score).toBe(75); // 15/(15+5) = 75%
  });

  test('returns 100 for all tests passed', async () => {
    const metric: Metric = {
      name: 'tests',
      command: 'echo "10 pass"',
      weight: 100,
      target: 100,
    };

    const result = await runMetric(metric);

    expect(result.score).toBe(100);
  });

  test('parses typescript errors', async () => {
    const metric: Metric = {
      name: 'typescript',
      command: 'echo "error TS2345: Type mismatch\nerror TS2322: Another error" && exit 1',
      weight: 100,
      target: 100,
    };

    const result = await runMetric(metric);

    expect(result.score).toBe(90); // 100 - (2 errors * 5) = 90
  });

  test('parses lint errors', async () => {
    const metric: Metric = {
      name: 'lint',
      command: 'echo "5 problems (3 errors, 2 warnings)" && exit 1',
      weight: 100,
      target: 100,
    };

    const result = await runMetric(metric);

    // 100 - (3 * 5 + 2 * 1) = 100 - 17 = 83
    expect(result.score).toBe(83);
  });

  test('parses coverage percentage', async () => {
    const metric: Metric = {
      name: 'coverage',
      command: 'echo "All files | 75.5% | 80% | 70%"',
      weight: 100,
      target: 100,
    };

    const result = await runMetric(metric);

    expect(result.score).toBe(76); // rounded from 75.5
  });

  test('parses simple coverage format', async () => {
    const metric: Metric = {
      name: 'coverage',
      command: 'echo "Coverage: 82.3%"',
      weight: 100,
      target: 100,
    };

    const result = await runMetric(metric);

    expect(result.score).toBe(82);
  });
});

describe('calculateScore', () => {
  test('calculates weighted average of metrics', async () => {
    const metrics: Metric[] = [
      { name: 'test1', command: 'echo "success"', weight: 100, target: 100 },
      { name: 'test2', command: 'echo "success"', weight: 100, target: 100 },
    ];

    const result = await calculateScore(metrics);

    expect(result.total).toBe(100);
    expect(result.metrics).toHaveLength(2);
  });

  test('handles mixed success/failure', async () => {
    const metrics: Metric[] = [
      { name: 'passing', command: 'echo "success"', weight: 100, target: 100 },
      { name: 'failing', command: 'exit 1', weight: 100, target: 100 },
    ];

    const result = await calculateScore(metrics);

    expect(result.total).toBe(50); // (100 + 0) / 2
  });

  test('respects different weights', async () => {
    const metrics: Metric[] = [
      { name: 'heavy', command: 'echo "success"', weight: 300, target: 100 },
      { name: 'light', command: 'exit 1', weight: 100, target: 100 },
    ];

    const result = await calculateScore(metrics);

    // (100 * 300 + 0 * 100) / 400 = 75
    expect(result.total).toBe(75);
  });

  test('handles empty metrics array', async () => {
    const result = await calculateScore([]);

    expect(result.total).toBe(0);
    expect(result.metrics).toHaveLength(0);
  });
});

describe('findWorstMetric', () => {
  test('returns the metric with the largest gap between target and score', () => {
    const scoreResult: ScoreResult = {
      total: 75,
      metrics: [
        { name: 'tests', score: 90, target: 100, weight: 100 },
        { name: 'lint', score: 60, target: 100, weight: 50 },
        { name: 'typescript', score: 80, target: 100, weight: 75 },
      ],
    };

    const worst = findWorstMetric(scoreResult);
    expect(worst.name).toBe('lint');
    expect(worst.score).toBe(60);
  });

  test('returns first metric when all have equal gaps', () => {
    const scoreResult: ScoreResult = {
      total: 80,
      metrics: [
        { name: 'tests', score: 80, target: 100, weight: 100 },
        { name: 'lint', score: 80, target: 100, weight: 50 },
      ],
    };

    const worst = findWorstMetric(scoreResult);
    expect(worst.name).toBe('tests');
  });

  test('handles single metric', () => {
    const scoreResult: ScoreResult = {
      total: 50,
      metrics: [{ name: 'tests', score: 50, target: 100, weight: 100 }],
    };

    const worst = findWorstMetric(scoreResult);
    expect(worst.name).toBe('tests');
    expect(worst.score).toBe(50);
  });

  test('handles metrics that exceed target', () => {
    const scoreResult: ScoreResult = {
      total: 100,
      metrics: [
        { name: 'tests', score: 100, target: 80, weight: 100 },
        { name: 'lint', score: 90, target: 100, weight: 50 },
      ],
    };

    const worst = findWorstMetric(scoreResult);
    expect(worst.name).toBe('lint'); // gap of 10, vs -20 for tests
  });
});

describe('parseTestOutput (via integration)', () => {
  // These tests verify the behavior through the runMetric function
  // For unit testing internal parsing, we'd need to export parseTestOutput
});
