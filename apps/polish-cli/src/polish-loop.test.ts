import { describe, test, expect } from 'bun:test';
import { runPolishLoop, runPolishLoopWithCallback, displayResults } from './polish-loop.js';
import type { PolishResult, ScoreResult } from './types.js';

describe('polish-loop exports', () => {
  test('runPolishLoop is exported and is a function', () => {
    expect(typeof runPolishLoop).toBe('function');
  });

  test('runPolishLoopWithCallback is exported and is a function', () => {
    expect(typeof runPolishLoopWithCallback).toBe('function');
  });

  test('displayResults is exported and is a function', () => {
    expect(typeof displayResults).toBe('function');
  });
});

describe('displayResults', () => {
  test('handles positive improvement', () => {
    const result: PolishResult = {
      initialScore: {
        total: 50,
        metrics: [{ name: 'tests', score: 50, target: 100, weight: 100 }],
      },
      finalScore: {
        total: 80,
        metrics: [{ name: 'tests', score: 80, target: 100, weight: 100 }],
      },
      iterations: 5,
      commits: ['abc123', 'def456'],
      reason: 'target_reached',
    };

    // displayResults outputs to console, so we just verify it doesn't throw
    expect(() => displayResults(result)).not.toThrow();
  });

  test('handles negative improvement', () => {
    const result: PolishResult = {
      initialScore: {
        total: 80,
        metrics: [{ name: 'tests', score: 80, target: 100, weight: 100 }],
      },
      finalScore: {
        total: 70,
        metrics: [{ name: 'tests', score: 70, target: 100, weight: 100 }],
      },
      iterations: 10,
      commits: [],
      reason: 'plateau',
    };

    expect(() => displayResults(result)).not.toThrow();
  });

  test('handles max iterations reason', () => {
    const result: PolishResult = {
      initialScore: {
        total: 60,
        metrics: [{ name: 'tests', score: 60, target: 100, weight: 100 }],
      },
      finalScore: {
        total: 75,
        metrics: [{ name: 'tests', score: 75, target: 100, weight: 100 }],
      },
      iterations: 50,
      commits: ['commit1'],
      reason: 'max_iterations',
    };

    expect(() => displayResults(result)).not.toThrow();
  });

  test('handles error reason', () => {
    const result: PolishResult = {
      initialScore: {
        total: 50,
        metrics: [{ name: 'tests', score: 50, target: 100, weight: 100 }],
      },
      finalScore: {
        total: 50,
        metrics: [{ name: 'tests', score: 50, target: 100, weight: 100 }],
      },
      iterations: 1,
      commits: [],
      reason: 'error',
    };

    expect(() => displayResults(result)).not.toThrow();
  });

  test('handles high score (green display)', () => {
    const result: PolishResult = {
      initialScore: {
        total: 95,
        metrics: [{ name: 'tests', score: 95, target: 100, weight: 100 }],
      },
      finalScore: {
        total: 100,
        metrics: [{ name: 'tests', score: 100, target: 100, weight: 100 }],
      },
      iterations: 2,
      commits: ['xyz789'],
      reason: 'target_reached',
    };

    expect(() => displayResults(result)).not.toThrow();
  });

  test('handles medium score (yellow display)', () => {
    const result: PolishResult = {
      initialScore: {
        total: 80,
        metrics: [{ name: 'tests', score: 80, target: 100, weight: 100 }],
      },
      finalScore: {
        total: 85,
        metrics: [{ name: 'tests', score: 85, target: 100, weight: 100 }],
      },
      iterations: 3,
      commits: [],
      reason: 'plateau',
    };

    expect(() => displayResults(result)).not.toThrow();
  });
});
