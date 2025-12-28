import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { glob } from 'glob';
/**
 * Detect the project stack (language, runtime, tools)
 */
export async function detectStack(cwd = process.cwd()) {
    const stack = {
        language: 'unknown',
        tools: [],
    };
    // Detect language
    if (existsSync(join(cwd, 'package.json'))) {
        stack.language = await detectTypeScript(cwd) ? 'typescript' : 'javascript';
        stack.runtime = detectJsRuntime(cwd);
        await detectJsTools(cwd, stack);
    }
    else if (existsSync(join(cwd, 'pyproject.toml')) ||
        existsSync(join(cwd, 'setup.py')) ||
        existsSync(join(cwd, 'requirements.txt'))) {
        stack.language = 'python';
        await detectPythonTools(cwd, stack);
    }
    else if (existsSync(join(cwd, 'Cargo.toml'))) {
        stack.language = 'rust';
        await detectRustTools(cwd, stack);
    }
    else if (existsSync(join(cwd, 'go.mod'))) {
        stack.language = 'go';
        await detectGoTools(cwd, stack);
    }
    else if (existsSync(join(cwd, 'pom.xml')) ||
        existsSync(join(cwd, 'build.gradle')) ||
        existsSync(join(cwd, 'build.gradle.kts'))) {
        stack.language = 'java';
        await detectJavaTools(cwd, stack);
    }
    return stack;
}
/**
 * Check if TypeScript is configured
 */
async function detectTypeScript(cwd) {
    if (existsSync(join(cwd, 'tsconfig.json'))) {
        return true;
    }
    // Check package.json for typescript dependency
    const pkgPath = join(cwd, 'package.json');
    if (existsSync(pkgPath)) {
        try {
            const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
            const deps = { ...pkg.dependencies, ...pkg.devDependencies };
            if (deps.typescript)
                return true;
        }
        catch {
            // Ignore parse errors
        }
    }
    return false;
}
/**
 * Detect JavaScript runtime (bun, deno, node)
 */
function detectJsRuntime(cwd) {
    if (existsSync(join(cwd, 'bun.lockb')) ||
        existsSync(join(cwd, 'bun.lock')) ||
        existsSync(join(cwd, 'bunfig.toml'))) {
        return 'bun';
    }
    if (existsSync(join(cwd, 'deno.json')) || existsSync(join(cwd, 'deno.jsonc'))) {
        return 'deno';
    }
    return 'node';
}
/**
 * Detect JavaScript/TypeScript tools
 */
async function detectJsTools(cwd, stack) {
    const runtime = stack.runtime ?? 'node';
    // Read package.json for dependencies
    let pkg = {};
    const pkgPath = join(cwd, 'package.json');
    if (existsSync(pkgPath)) {
        try {
            pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
        }
        catch {
            // Ignore
        }
    }
    const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
    const scripts = pkg.scripts || {};
    // Detect test runner
    const vitestConfig = await glob('vitest.config.*', { cwd });
    const jestConfig = await glob('jest.config.*', { cwd });
    if (vitestConfig.length > 0 || deps.vitest) {
        stack.tools.push({
            category: 'tests',
            name: 'vitest',
            confidence: vitestConfig.length > 0 ? 'high' : 'medium',
            verification: 'javascript/tests/vitest',
            command: 'npx vitest run',
        });
    }
    else if (jestConfig.length > 0 || deps.jest) {
        stack.tools.push({
            category: 'tests',
            name: 'jest',
            confidence: jestConfig.length > 0 ? 'high' : 'medium',
            verification: 'javascript/tests/jest',
            command: 'npx jest',
        });
    }
    else if (runtime === 'bun') {
        stack.tools.push({
            category: 'tests',
            name: 'bun-test',
            confidence: 'medium',
            verification: 'javascript/tests/bun',
            command: 'bun test',
        });
    }
    else if (scripts.test && !scripts.test.includes('no test')) {
        // Has a test script defined
        stack.tools.push({
            category: 'tests',
            name: 'npm-test',
            confidence: 'low',
            verification: 'javascript/tests/npm',
            command: 'npm test',
        });
    }
    // Detect linter
    const biomeConfig = existsSync(join(cwd, 'biome.json')) || existsSync(join(cwd, 'biome.jsonc'));
    const eslintConfig = await glob('.eslintrc*', { cwd });
    const eslintConfigNew = await glob('eslint.config.*', { cwd });
    if (biomeConfig || deps['@biomejs/biome']) {
        stack.tools.push({
            category: 'lint',
            name: 'biome',
            confidence: biomeConfig ? 'high' : 'medium',
            verification: 'javascript/lint/biome',
            command: 'npx @biomejs/biome check .',
        });
    }
    else if (eslintConfig.length > 0 || eslintConfigNew.length > 0 || deps.eslint) {
        stack.tools.push({
            category: 'lint',
            name: 'eslint',
            confidence: eslintConfig.length > 0 || eslintConfigNew.length > 0 ? 'high' : 'medium',
            verification: 'javascript/lint/eslint',
            command: 'npx eslint .',
        });
    }
    // Detect TypeScript
    if (stack.language === 'typescript' || existsSync(join(cwd, 'tsconfig.json'))) {
        stack.tools.push({
            category: 'types',
            name: 'typescript',
            confidence: 'high',
            verification: 'javascript/types/typescript',
            command: 'npx tsc --noEmit',
        });
    }
    // Detect build tool
    if (scripts.build) {
        stack.tools.push({
            category: 'build',
            name: 'build',
            confidence: 'medium',
            verification: 'javascript/build/npm',
            command: runtime === 'bun' ? 'bun run build' : 'npm run build',
        });
    }
}
/**
 * Detect Python tools
 */
async function detectPythonTools(cwd, stack) {
    // Read pyproject.toml if exists
    let pyproject = '';
    const pyprojectPath = join(cwd, 'pyproject.toml');
    if (existsSync(pyprojectPath)) {
        pyproject = readFileSync(pyprojectPath, 'utf-8');
    }
    // Detect test runner
    const pytestIni = existsSync(join(cwd, 'pytest.ini'));
    const hasPytest = pyproject.includes('[tool.pytest]') || pyproject.includes('pytest');
    if (pytestIni || hasPytest) {
        stack.tools.push({
            category: 'tests',
            name: 'pytest',
            confidence: pytestIni ? 'high' : 'medium',
            verification: 'python/tests/pytest',
            command: 'pytest',
        });
    }
    else {
        // Check for test directory
        const testsDir = existsSync(join(cwd, 'tests')) || existsSync(join(cwd, 'test'));
        if (testsDir) {
            stack.tools.push({
                category: 'tests',
                name: 'pytest',
                confidence: 'low',
                verification: 'python/tests/pytest',
                command: 'pytest',
            });
        }
    }
    // Detect linter
    const ruffToml = existsSync(join(cwd, 'ruff.toml'));
    const hasRuff = pyproject.includes('[tool.ruff]') || pyproject.includes('ruff');
    const pylintrc = existsSync(join(cwd, '.pylintrc')) || existsSync(join(cwd, 'pylintrc'));
    if (ruffToml || hasRuff) {
        stack.tools.push({
            category: 'lint',
            name: 'ruff',
            confidence: ruffToml ? 'high' : 'medium',
            verification: 'python/lint/ruff',
            command: 'ruff check .',
        });
    }
    else if (pylintrc || pyproject.includes('pylint')) {
        stack.tools.push({
            category: 'lint',
            name: 'pylint',
            confidence: pylintrc ? 'high' : 'medium',
            verification: 'python/lint/pylint',
            command: 'pylint .',
        });
    }
    // Detect type checker
    const mypyIni = existsSync(join(cwd, 'mypy.ini'));
    const hasMypy = pyproject.includes('[tool.mypy]') || pyproject.includes('mypy');
    const pyrightConfig = existsSync(join(cwd, 'pyrightconfig.json'));
    if (mypyIni || hasMypy) {
        stack.tools.push({
            category: 'types',
            name: 'mypy',
            confidence: mypyIni ? 'high' : 'medium',
            verification: 'python/types/mypy',
            command: 'mypy .',
        });
    }
    else if (pyrightConfig || pyproject.includes('pyright')) {
        stack.tools.push({
            category: 'types',
            name: 'pyright',
            confidence: pyrightConfig ? 'high' : 'medium',
            verification: 'python/types/pyright',
            command: 'pyright',
        });
    }
}
/**
 * Detect Rust tools
 */
async function detectRustTools(cwd, stack) {
    // Rust projects always have cargo test
    stack.tools.push({
        category: 'tests',
        name: 'cargo-test',
        confidence: 'high',
        verification: 'rust/tests/cargo',
        command: 'cargo test',
    });
    // Clippy for linting
    stack.tools.push({
        category: 'lint',
        name: 'clippy',
        confidence: 'high',
        verification: 'rust/lint/clippy',
        command: 'cargo clippy -- -D warnings',
    });
    // Build check
    stack.tools.push({
        category: 'build',
        name: 'cargo-build',
        confidence: 'high',
        verification: 'rust/build/cargo',
        command: 'cargo build',
    });
}
/**
 * Detect Go tools
 */
async function detectGoTools(cwd, stack) {
    // Go projects always have go test
    stack.tools.push({
        category: 'tests',
        name: 'go-test',
        confidence: 'high',
        verification: 'go/tests/go',
        command: 'go test ./...',
    });
    // Check for golangci-lint config
    const golangciConfig = await glob('.golangci.*', { cwd });
    if (golangciConfig.length > 0) {
        stack.tools.push({
            category: 'lint',
            name: 'golangci-lint',
            confidence: 'high',
            verification: 'go/lint/golangci',
            command: 'golangci-lint run',
        });
    }
    else {
        // Default to go vet
        stack.tools.push({
            category: 'lint',
            name: 'go-vet',
            confidence: 'medium',
            verification: 'go/lint/vet',
            command: 'go vet ./...',
        });
    }
    // Build check
    stack.tools.push({
        category: 'build',
        name: 'go-build',
        confidence: 'high',
        verification: 'go/build/go',
        command: 'go build ./...',
    });
}
/**
 * Detect Java tools
 */
async function detectJavaTools(cwd, stack) {
    const hasMaven = existsSync(join(cwd, 'pom.xml'));
    const hasGradle = existsSync(join(cwd, 'build.gradle')) || existsSync(join(cwd, 'build.gradle.kts'));
    if (hasMaven) {
        stack.tools.push({
            category: 'tests',
            name: 'maven-test',
            confidence: 'high',
            verification: 'java/tests/maven',
            command: 'mvn test',
        });
        stack.tools.push({
            category: 'build',
            name: 'maven-build',
            confidence: 'high',
            verification: 'java/build/maven',
            command: 'mvn compile',
        });
    }
    else if (hasGradle) {
        stack.tools.push({
            category: 'tests',
            name: 'gradle-test',
            confidence: 'high',
            verification: 'java/tests/gradle',
            command: './gradlew test',
        });
        stack.tools.push({
            category: 'build',
            name: 'gradle-build',
            confidence: 'high',
            verification: 'java/build/gradle',
            command: './gradlew build',
        });
    }
}
/**
 * Get a human-readable summary of the detected stack
 */
export function getStackSummary(stack) {
    const parts = [];
    if (stack.language !== 'unknown') {
        let lang = stack.language.charAt(0).toUpperCase() + stack.language.slice(1);
        if (stack.runtime && stack.runtime !== 'node') {
            lang += ` (${stack.runtime})`;
        }
        parts.push(lang);
    }
    if (stack.tools.length > 0) {
        const toolNames = stack.tools.map((t) => t.name).join(', ');
        parts.push(`Tools: ${toolNames}`);
    }
    return parts.join(' | ') || 'Unknown stack';
}
