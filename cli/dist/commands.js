import { exec } from 'child_process';
import { promisify } from 'util';
const execAsync = promisify(exec);
/**
 * Built-in command library for TypeScript projects
 */
export const BUILTIN_COMMANDS = {
    // Test commands
    'test': {
        name: 'test',
        description: 'Run tests with Bun',
        command: 'bun test',
        category: 'test',
        details: 'Runs all test files matching *.test.ts, *.spec.ts patterns using Bun\'s built-in test runner.',
        onError: 'Check the failing test output. Common issues: missing mocks, async tests not awaited, incorrect assertions. Run specific test with: bun test path/to/file.test.ts',
    },
    'test:watch': {
        name: 'test:watch',
        description: 'Run tests in watch mode',
        command: 'bun test --watch',
        category: 'test',
        details: 'Runs tests and re-runs them when files change. Press q to quit.',
    },
    'test:coverage': {
        name: 'test:coverage',
        description: 'Run tests with coverage',
        command: 'bun test --coverage',
        category: 'test',
        details: 'Runs tests and generates a coverage report showing which lines of code are tested.',
        onError: 'If coverage is low, add tests for uncovered functions. Focus on critical business logic first.',
    },
    'vitest': {
        name: 'vitest',
        description: 'Run tests with Vitest',
        command: 'npx vitest run',
        category: 'test',
        details: 'Runs tests using Vitest. Supports ESM, TypeScript, and JSX out of the box.',
        onError: 'Check vitest.config.ts for configuration issues. Ensure test files match the include patterns.',
    },
    'jest': {
        name: 'jest',
        description: 'Run tests with Jest',
        command: 'npx jest',
        category: 'test',
        details: 'Runs tests using Jest. Requires jest.config.js or package.json jest config.',
        onError: 'Check jest.config.js. For TypeScript, ensure ts-jest or babel is configured. Run jest --clearCache if tests are stale.',
    },
    // Type checking
    'typecheck': {
        name: 'typecheck',
        description: 'Type check with TypeScript compiler',
        command: 'npx tsc --noEmit',
        category: 'build',
        details: 'Runs TypeScript compiler without emitting files. Checks all files in tsconfig.json include patterns.',
        onError: 'Fix type errors shown in output. Common issues: missing types (@types/xxx), incorrect generics, null checks. Add // @ts-expect-error only as last resort.',
    },
    'typecheck:watch': {
        name: 'typecheck:watch',
        description: 'Type check in watch mode',
        command: 'npx tsc --noEmit --watch',
        category: 'build',
        details: 'Continuously type-checks as you edit files. Press Ctrl+C to stop.',
    },
    // Linting
    'lint': {
        name: 'lint',
        description: 'Lint code with ESLint',
        command: 'npx eslint .',
        category: 'lint',
        details: 'Analyzes code for potential errors and style issues using ESLint rules defined in eslint.config.js or .eslintrc.',
        onError: 'Fix issues shown in output. Run "polish run lint:fix" to auto-fix some issues. For rules you disagree with, disable them in eslint config, not with inline comments.',
    },
    'lint:fix': {
        name: 'lint:fix',
        description: 'Lint and fix code with ESLint',
        command: 'npx eslint . --fix',
        category: 'lint',
        details: 'Runs ESLint and automatically fixes all auto-fixable issues (formatting, imports order, etc.).',
        onError: 'Some issues cannot be auto-fixed. Check the remaining errors and fix them manually.',
    },
    'biome:check': {
        name: 'biome:check',
        description: 'Check code with Biome',
        command: 'npx @biomejs/biome check .',
        category: 'lint',
        details: 'Fast linter and formatter. Checks for lint errors and formatting issues in one pass.',
        onError: 'Run "polish run biome:fix" to auto-fix issues. Configure rules in biome.json.',
    },
    'biome:fix': {
        name: 'biome:fix',
        description: 'Check and fix code with Biome',
        command: 'npx @biomejs/biome check . --write',
        category: 'lint',
        details: 'Runs Biome and automatically fixes all issues it can, including formatting.',
    },
    // Formatting
    'format': {
        name: 'format',
        description: 'Format code with Prettier',
        command: 'npx prettier --write .',
        category: 'format',
        details: 'Formats all supported files in the project according to Prettier config (.prettierrc).',
    },
    'format:check': {
        name: 'format:check',
        description: 'Check code formatting with Prettier',
        command: 'npx prettier --check .',
        category: 'format',
        details: 'Checks if files are formatted correctly without modifying them.',
        onError: 'Run "polish run format" to fix formatting. If specific files fail, check .prettierignore.',
    },
    'biome:format': {
        name: 'biome:format',
        description: 'Format code with Biome',
        command: 'npx @biomejs/biome format . --write',
        category: 'format',
        details: 'Formats code using Biome. Faster than Prettier, with similar output.',
    },
    // Build
    'build': {
        name: 'build',
        description: 'Build the project',
        command: 'bun run build',
        category: 'build',
        details: 'Runs the build script defined in package.json. Usually compiles TypeScript and bundles the project.',
        onError: 'Check for TypeScript errors first with "polish run typecheck". Build errors often come from type issues, missing dependencies, or incorrect import paths.',
    },
    'build:watch': {
        name: 'build:watch',
        description: 'Build in watch mode',
        command: 'bun run build --watch',
        category: 'build',
        details: 'Continuously rebuilds when source files change.',
    },
    // Security
    'audit': {
        name: 'audit',
        description: 'Check for security vulnerabilities',
        command: 'npm audit',
        category: 'security',
        details: 'Scans dependencies for known security vulnerabilities using the npm advisory database.',
        onError: 'Run "polish run audit:fix" to auto-fix. For vulnerabilities that can\'t be fixed automatically, check if newer versions exist or find alternative packages.',
    },
    'audit:fix': {
        name: 'audit:fix',
        description: 'Fix security vulnerabilities',
        command: 'npm audit fix',
        category: 'security',
        details: 'Automatically updates packages to fix known vulnerabilities when possible.',
        onError: 'Some vulnerabilities require manual intervention. Use "npm audit fix --force" carefully as it may introduce breaking changes.',
    },
    // Quality
    'duplication': {
        name: 'duplication',
        description: 'Check for code duplication with jscpd',
        command: 'npx jscpd src --threshold 5',
        category: 'quality',
        details: 'Detects copy-pasted code blocks. Threshold 5 means blocks with >5% duplication are flagged.',
        onError: 'Extract duplicated code into shared functions or modules. Check the report to see which files have duplication.',
    },
    'complexity': {
        name: 'complexity',
        description: 'Analyze code complexity',
        command: 'npx complexity-report src',
        category: 'quality',
        details: 'Measures cyclomatic complexity, lines of code, and maintainability index for each function.',
        onError: 'Refactor complex functions. Break down functions with high cyclomatic complexity (>10) into smaller, focused functions.',
    },
    'size': {
        name: 'size',
        description: 'Check bundle size',
        command: 'npx size-limit',
        category: 'quality',
        details: 'Checks if your bundle size exceeds the limit defined in package.json or .size-limit.json.',
        onError: 'Analyze bundle with "npx size-limit --why". Common fixes: lazy loading, removing unused dependencies, using lighter alternatives.',
    },
    'deadcode': {
        name: 'deadcode',
        description: 'Find unused exports with ts-prune',
        command: 'npx ts-prune',
        category: 'quality',
        details: 'Finds exported functions, types, and variables that are never imported anywhere.',
        onError: 'Remove unused exports or add them to ts-prune.json ignore list if they\'re used externally (e.g., public API).',
    },
};
/**
 * Get all built-in command names
 */
export function getBuiltinCommandNames() {
    return Object.keys(BUILTIN_COMMANDS);
}
/**
 * Get a built-in command by name
 */
export function getBuiltinCommand(name) {
    return BUILTIN_COMMANDS[name];
}
/**
 * Get all commands (built-in + custom from config)
 * Custom commands override built-ins with the same name
 * Custom overrides inherit category from built-in if not specified
 */
export function getAllCommands(config) {
    const customList = config?.commands ?? [];
    const customNames = new Set(customList.map(c => c.name));
    // Filter out built-ins that are overridden by custom commands
    const builtinList = Object.values(BUILTIN_COMMANDS).filter(cmd => !customNames.has(cmd.name));
    // For custom commands that override built-ins, inherit category if not specified
    const mergedCustomList = customList.map(cmd => {
        const builtin = BUILTIN_COMMANDS[cmd.name];
        if (builtin && !cmd.category) {
            return { ...cmd, category: builtin.category };
        }
        return cmd;
    });
    return [...builtinList, ...mergedCustomList];
}
/**
 * Get a command by name (checks custom first, then built-in)
 * Custom commands inherit category from built-in if overriding
 */
export function getCommand(name, config) {
    // Check custom commands first (allows overriding built-ins)
    const customCommand = config?.commands?.find(cmd => cmd.name === name);
    if (customCommand) {
        // Inherit category from built-in if overriding and no category specified
        const builtin = BUILTIN_COMMANDS[name];
        if (builtin && !customCommand.category) {
            return { ...customCommand, category: builtin.category };
        }
        return customCommand;
    }
    return BUILTIN_COMMANDS[name];
}
/**
 * Get commands grouped by category
 */
export function getCommandsByCategory(config) {
    const allCommands = getAllCommands(config);
    const grouped = {};
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
export async function executeCommand(cmd) {
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
    }
    catch (error) {
        const execError = error;
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
export async function runCommand(name, config) {
    const cmd = getCommand(name, config);
    if (!cmd) {
        return null;
    }
    return executeCommand(cmd);
}
/**
 * Format command result for display
 */
export function formatCommandResult(result, cmd) {
    const status = result.success ? '✓' : '✗';
    const duration = `${(result.duration / 1000).toFixed(2)}s`;
    let output = `${status} ${result.name} (${duration})\n`;
    if (result.stdout.trim()) {
        output += '\n' + result.stdout.trim() + '\n';
    }
    if (result.stderr.trim() && !result.success) {
        output += '\nErrors:\n' + result.stderr.trim() + '\n';
    }
    // Show onError help when command fails
    if (!result.success && cmd?.onError) {
        output += '\n💡 How to fix:\n' + cmd.onError + '\n';
    }
    return output;
}
