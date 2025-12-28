/**
 * Generate a Polish config from detected stack
 */
export function generateConfig(stack) {
    const metrics = [];
    // Convert detected tools to metrics
    for (const tool of stack.tools) {
        const metric = toolToMetric(tool, stack);
        if (metric) {
            metrics.push(metric);
        }
    }
    // If no tools detected, add basic metrics based on language
    if (metrics.length === 0) {
        const defaultMetrics = getDefaultMetrics(stack);
        metrics.push(...defaultMetrics);
    }
    return {
        metrics,
        target: 95,
        maxIterations: 50,
    };
}
/**
 * Convert a detected tool to a metric
 */
function toolToMetric(tool, stack) {
    const command = tool.command || getDefaultCommand(tool.name, stack);
    if (!command)
        return null;
    // Map category to weight
    const weightMap = {
        tests: 100,
        build: 100,
        types: 100,
        lint: 80,
        format: 60,
        quality: 60,
        security: 80,
    };
    // Map category to target
    const targetMap = {
        tests: 100,
        build: 100,
        types: 100,
        lint: 100,
        format: 100,
        quality: 95,
        security: 100,
    };
    // Map to canonical names for backward compat with metrics.ts parsing
    const nameMap = {
        'bun-test': 'tests',
        vitest: 'tests',
        jest: 'tests',
        'npm-test': 'tests',
        pytest: 'tests',
        'cargo-test': 'tests',
        'go-test': 'tests',
        'maven-test': 'tests',
        'gradle-test': 'tests',
        eslint: 'lint',
        biome: 'lint',
        ruff: 'lint',
        pylint: 'lint',
        clippy: 'lint',
        'golangci-lint': 'lint',
        'go-vet': 'lint',
        typescript: 'typescript',
        mypy: 'types',
        pyright: 'types',
        'cargo-build': 'build',
        'go-build': 'build',
        'maven-build': 'build',
        'gradle-build': 'build',
        build: 'build',
    };
    return {
        name: nameMap[tool.name] || tool.name,
        command,
        weight: weightMap[tool.category] || 80,
        target: targetMap[tool.category] || 100,
    };
}
/**
 * Get default command for a tool
 */
function getDefaultCommand(toolName, stack) {
    const commands = {
        // JavaScript/TypeScript
        'bun-test': 'bun test',
        vitest: 'npx vitest run',
        jest: 'npx jest',
        'npm-test': stack.runtime === 'bun' ? 'bun test' : 'npm test',
        eslint: 'npx eslint .',
        biome: 'npx @biomejs/biome check .',
        typescript: 'npx tsc --noEmit',
        build: stack.runtime === 'bun' ? 'bun run build' : 'npm run build',
        // Python
        pytest: 'pytest',
        ruff: 'ruff check .',
        pylint: 'pylint .',
        mypy: 'mypy .',
        pyright: 'pyright',
        // Rust
        'cargo-test': 'cargo test',
        clippy: 'cargo clippy -- -D warnings',
        'cargo-build': 'cargo build',
        // Go
        'go-test': 'go test ./...',
        'golangci-lint': 'golangci-lint run',
        'go-vet': 'go vet ./...',
        'go-build': 'go build ./...',
        // Java
        'maven-test': 'mvn test',
        'maven-build': 'mvn compile',
        'gradle-test': './gradlew test',
        'gradle-build': './gradlew build',
    };
    return commands[toolName] || null;
}
/**
 * Get default metrics when no tools detected
 */
function getDefaultMetrics(stack) {
    switch (stack.language) {
        case 'javascript':
        case 'typescript':
            return [
                {
                    name: 'tests',
                    command: stack.runtime === 'bun' ? 'bun test' : 'npm test',
                    weight: 100,
                    target: 100,
                },
                {
                    name: 'build',
                    command: stack.runtime === 'bun' ? 'bun run build' : 'npm run build',
                    weight: 100,
                    target: 100,
                },
            ];
        case 'python':
            return [
                { name: 'tests', command: 'pytest', weight: 100, target: 100 },
            ];
        case 'rust':
            return [
                { name: 'tests', command: 'cargo test', weight: 100, target: 100 },
                { name: 'build', command: 'cargo build', weight: 100, target: 100 },
            ];
        case 'go':
            return [
                { name: 'tests', command: 'go test ./...', weight: 100, target: 100 },
                { name: 'build', command: 'go build ./...', weight: 100, target: 100 },
            ];
        case 'java':
            return [
                { name: 'tests', command: 'mvn test', weight: 100, target: 100 },
                { name: 'build', command: 'mvn compile', weight: 100, target: 100 },
            ];
        default:
            return [];
    }
}
