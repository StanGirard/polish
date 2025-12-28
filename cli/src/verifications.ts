import type { Metric } from './types.js';

/**
 * Verification definition with metadata for display
 */
export interface VerificationDef {
  name: string;
  description: string;
  command: string;
  weight: number;
  target: number;
  details?: string;
}

/**
 * Built-in verifications registry
 */
export const VERIFICATIONS: Record<string, VerificationDef> = {
  tests: {
    name: 'tests',
    description: 'Run test suite',
    command: 'bun test',
    weight: 100,
    target: 100,
    details: 'Runs your test suite. Score is 100 if all tests pass, 0 if any fail (strict mode).',
  },
  typescript: {
    name: 'typescript',
    description: 'Type check with TypeScript compiler',
    command: 'npx tsc --noEmit',
    weight: 100,
    target: 100,
    details: 'Runs tsc --noEmit to check for type errors. Score decreases by 5 points per error.',
  },
  lint: {
    name: 'lint',
    description: 'Lint code with ESLint',
    command: 'npx eslint .',
    weight: 80,
    target: 100,
    details: 'Runs ESLint on your codebase. Errors cost 5 points each, warnings cost 1 point.',
  },
  build: {
    name: 'build',
    description: 'Build the project',
    command: 'bun run build',
    weight: 100,
    target: 100,
    details: 'Runs your build script. Binary pass/fail - 100 if succeeds, 0 if fails.',
  },
  duplication: {
    name: 'duplication',
    description: 'Check for code duplication (jscpd)',
    command: 'npx jscpd src --threshold 5',
    weight: 60,
    target: 95,
    details: 'Detects copy-pasted code using jscpd. Score = 100 - duplication%. Threshold 5% means files with >5% duplication are flagged.',
  },
};

/**
 * Get all verification names
 */
export function getVerificationNames(): string[] {
  return Object.keys(VERIFICATIONS);
}

/**
 * Get a verification by name
 */
export function getVerification(name: string): VerificationDef | undefined {
  return VERIFICATIONS[name];
}

/**
 * Convert a verification definition to a metric config
 */
export function verificationToMetric(
  def: VerificationDef,
  overrides?: { command?: string; weight?: number; target?: number }
): Metric {
  return {
    name: def.name,
    command: overrides?.command ?? def.command,
    weight: overrides?.weight ?? def.weight,
    target: overrides?.target ?? def.target,
  };
}

/**
 * Get verification command customized for runtime
 */
export function getVerificationCommand(name: string, runtime: 'bun' | 'node' | 'deno' = 'node'): string {
  const def = VERIFICATIONS[name];
  if (!def) return '';

  // Customize commands based on runtime
  if (runtime === 'bun') {
    switch (name) {
      case 'tests':
        return 'bun test';
      case 'build':
        return 'bun run build';
    }
  } else if (runtime === 'node') {
    switch (name) {
      case 'tests':
        return 'npm test';
      case 'build':
        return 'npm run build';
    }
  }

  return def.command;
}
