import { exec } from 'child_process';
import { promisify } from 'util';
import type { CustomCommand, CommandResult, PolishConfig } from './types.js';

const execAsync = promisify(exec);

/**
 * Built-in command library for TypeScript projects
 */
export const BUILTIN_COMMANDS: Record<string, CustomCommand> = {
  // Test commands
  'test': {
    name: 'test',
    description: 'Run tests with Bun',
    command: 'bun test',
    category: 'test',
  },
  'test:watch': {
    name: 'test:watch',
    description: 'Run tests in watch mode',
    command: 'bun test --watch',
    category: 'test',
  },
  'test:coverage': {
    name: 'test:coverage',
    description: 'Run tests with coverage',
    command: 'bun test --coverage',
    category: 'test',
  },
  'vitest': {
    name: 'vitest',
    description: 'Run tests with Vitest',
    command: 'npx vitest run',
    category: 'test',
  },
  'jest': {
    name: 'jest',
    description: 'Run tests with Jest',
    command: 'npx jest',
    category: 'test',
  },

  // Type checking
  'typecheck': {
    name: 'typecheck',
    description: 'Type check with TypeScript compiler',
    command: 'npx tsc --noEmit',
    category: 'build',
  },
  'typecheck:watch': {
    name: 'typecheck:watch',
    description: 'Type check in watch mode',
    command: 'npx tsc --noEmit --watch',
    category: 'build',
  },

  // Linting
  'lint': {
    name: 'lint',
    description: 'Lint code with ESLint',
    command: 'npx eslint .',
    category: 'lint',
  },
  'lint:fix': {
    name: 'lint:fix',
    description: 'Lint and fix code with ESLint',
    command: 'npx eslint . --fix',
    category: 'lint',
  },
  'biome:check': {
    name: 'biome:check',
    description: 'Check code with Biome',
    command: 'npx @biomejs/biome check .',
    category: 'lint',
  },
  'biome:fix': {
    name: 'biome:fix',
    description: 'Check and fix code with Biome',
    command: 'npx @biomejs/biome check . --write',
    category: 'lint',
  },

  // Formatting
  'format': {
    name: 'format',
    description: 'Format code with Prettier',
    command: 'npx prettier --write .',
    category: 'format',
  },
  'format:check': {
    name: 'format:check',
    description: 'Check code formatting with Prettier',
    command: 'npx prettier --check .',
    category: 'format',
  },
  'biome:format': {
    name: 'biome:format',
    description: 'Format code with Biome',
    command: 'npx @biomejs/biome format . --write',
    category: 'format',
  },

  // Build
  'build': {
    name: 'build',
    description: 'Build the project',
    command: 'bun run build',
    category: 'build',
  },
  'build:watch': {
    name: 'build:watch',
    description: 'Build in watch mode',
    command: 'bun run build --watch',
    category: 'build',
  },

  // Security
  'audit': {
    name: 'audit',
    description: 'Check for security vulnerabilities',
    command: 'npm audit',
    category: 'security',
  },
  'audit:fix': {
    name: 'audit:fix',
    description: 'Fix security vulnerabilities',
    command: 'npm audit fix',
    category: 'security',
  },

  // Quality
  'duplication': {
    name: 'duplication',
    description: 'Check for code duplication with jscpd',
    command: 'npx jscpd src --threshold 5',
    category: 'quality',
  },
  'complexity': {
    name: 'complexity',
    description: 'Analyze code complexity',
    command: 'npx complexity-report src',
    category: 'quality',
  },
  'size': {
    name: 'size',
    description: 'Check bundle size',
    command: 'npx size-limit',
    category: 'quality',
  },
  'deadcode': {
    name: 'deadcode',
    description: 'Find unused exports with ts-prune',
    command: 'npx ts-prune',
    category: 'quality',
  },
};

/**
 * Get all built-in command names
 */
export function getBuiltinCommandNames(): string[] {
  return Object.keys(BUILTIN_COMMANDS);
}

/**
 * Get a built-in command by name
 */
export function getBuiltinCommand(name: string): CustomCommand | undefined {
  return BUILTIN_COMMANDS[name];
}

/**
 * Get all commands (built-in + custom from config)
 */
export function getAllCommands(config?: PolishConfig): CustomCommand[] {
  const builtinList = Object.values(BUILTIN_COMMANDS);
  const customList = config?.commands ?? [];
  return [...builtinList, ...customList];
}

/**
 * Get a command by name (checks custom first, then built-in)
 */
export function getCommand(name: string, config?: PolishConfig): CustomCommand | undefined {
  // Check custom commands first (allows overriding built-ins)
  const customCommand = config?.commands?.find(cmd => cmd.name === name);
  if (customCommand) {
    return customCommand;
  }
  return BUILTIN_COMMANDS[name];
}

/**
 * Get commands grouped by category
 */
export function getCommandsByCategory(config?: PolishConfig): Record<string, CustomCommand[]> {
  const allCommands = getAllCommands(config);
  const grouped: Record<string, CustomCommand[]> = {};

  for (const cmd of allCommands) {
    const category = cmd.category ?? 'other';
    if (!grouped[category]) {
      grouped[category] = [];
    }
    grouped[category].push(cmd);
  }

  return grouped;
}

/**
 * Execute a command and return the result
 */
export async function executeCommand(cmd: CustomCommand): Promise<CommandResult> {
  const start = Date.now();

  try {
    const { stdout, stderr } = await execAsync(cmd.command, {
      timeout: 5 * 60 * 1000, // 5 minutes
      maxBuffer: 10 * 1024 * 1024, // 10MB
      cwd: process.cwd(),
    });

    return {
      name: cmd.name,
      success: true,
      exitCode: 0,
      stdout,
      stderr,
      duration: Date.now() - start,
    };
  } catch (error: unknown) {
    const execError = error as { code?: number; stdout?: string; stderr?: string };
    return {
      name: cmd.name,
      success: false,
      exitCode: execError.code ?? 1,
      stdout: execError.stdout ?? '',
      stderr: execError.stderr ?? (error instanceof Error ? error.message : String(error)),
      duration: Date.now() - start,
    };
  }
}

/**
 * Run a command by name
 */
export async function runCommand(
  name: string,
  config?: PolishConfig
): Promise<CommandResult | null> {
  const cmd = getCommand(name, config);
  if (!cmd) {
    return null;
  }
  return executeCommand(cmd);
}

/**
 * Format command result for display
 */
export function formatCommandResult(result: CommandResult): string {
  const status = result.success ? '✓' : '✗';
  const duration = `${(result.duration / 1000).toFixed(2)}s`;

  let output = `${status} ${result.name} (${duration})\n`;

  if (result.stdout.trim()) {
    output += '\n' + result.stdout.trim() + '\n';
  }

  if (result.stderr.trim() && !result.success) {
    output += '\nErrors:\n' + result.stderr.trim() + '\n';
  }

  return output;
}
