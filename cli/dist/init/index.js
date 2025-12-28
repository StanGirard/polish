import { join } from 'path';
import { checkbox } from '@inquirer/prompts';
import { detectStack, getStackSummary } from './detectors.js';
import { saveConfig, getConfigPath } from '../config.js';
import { VERIFICATIONS, verificationToMetric, getVerificationCommand } from '../verifications.js';
/**
 * Initialize Polish configuration for the current project
 */
export async function initCommand(options = {}) {
    const cwd = process.cwd();
    // Check if config already exists
    const existingConfig = getConfigPath(cwd);
    if (existingConfig && !options.force) {
        console.error(`Configuration already exists at ${existingConfig}`);
        console.error('Use --force to overwrite.');
        process.exit(1);
    }
    console.log('Detecting project stack...\n');
    // Detect stack
    const stack = await detectStack(cwd);
    if (stack.language === 'unknown') {
        console.error('Could not detect project type.');
        console.error('Make sure you have one of: package.json, pyproject.toml, Cargo.toml, go.mod');
        process.exit(1);
    }
    console.log(`Detected: ${getStackSummary(stack)}\n`);
    // Show detected tools
    if (stack.tools.length > 0) {
        console.log('Found tools in your project:');
        for (const tool of stack.tools) {
            console.log(`  ✓ ${tool.name} (${tool.category})`);
        }
        console.log('');
    }
    // Get detected verification names
    const detectedNames = new Set(stack.tools.map((t) => getCanonicalName(t.name)));
    // Build choices for interactive selection
    const choices = Object.entries(VERIFICATIONS).map(([name, def]) => {
        const isDetected = detectedNames.has(name);
        const command = getVerificationCommand(name, stack.runtime);
        return {
            name: `${name.padEnd(12)} - ${def.description} (${command})`,
            value: name,
            checked: isDetected, // Pre-select detected tools
        };
    });
    let selectedNames;
    if (options.yes) {
        // Non-interactive: use detected tools
        selectedNames = Array.from(detectedNames);
        console.log('Using detected verifications (--yes flag).\n');
    }
    else {
        // Interactive: let user select
        console.log('Select verifications to include:\n');
        selectedNames = await checkbox({
            message: 'Verifications',
            choices,
            pageSize: 10,
        });
    }
    if (selectedNames.length === 0) {
        console.error('\nNo verifications selected. Aborting.');
        process.exit(1);
    }
    // Build metrics from selections
    const metrics = selectedNames.map((name) => {
        const def = VERIFICATIONS[name];
        const command = getVerificationCommand(name, stack.runtime);
        return verificationToMetric(def, { command });
    });
    const config = {
        metrics,
        target: 95,
        maxIterations: 50,
    };
    if (options.dryRun) {
        console.log('\nGenerated configuration (dry run):\n');
        console.log(JSON.stringify(config, null, 2));
        return;
    }
    // Save config
    const configPath = join(cwd, 'polish.config.json');
    await saveConfig(config, configPath);
    console.log(`\nCreated ${configPath}\n`);
    console.log('Verifications configured:');
    for (const metric of config.metrics) {
        console.log(`  - ${metric.name}: ${metric.command}`);
    }
    console.log(`\nTarget score: ${config.target}`);
    console.log('\nNext steps:');
    console.log('  1. Run "polish hook install" to enable the Claude Code hook');
    console.log('  2. Run "polish status" to check current scores');
    console.log('  3. Run "polish add <name>" to add more verifications');
    console.log('  4. Run "polish bank list" to see available verifications');
}
/**
 * Map tool names to canonical verification names
 */
function getCanonicalName(toolName) {
    const mapping = {
        'bun-test': 'tests',
        vitest: 'tests',
        jest: 'tests',
        'npm-test': 'tests',
        pytest: 'tests',
        eslint: 'lint',
        biome: 'lint',
        ruff: 'lint',
        typescript: 'typescript',
        mypy: 'typescript',
        build: 'build',
        'cargo-build': 'build',
        'go-build': 'build',
    };
    return mapping[toolName] || toolName;
}
/**
 * Re-export for use in other modules
 */
export { detectStack, getStackSummary } from './detectors.js';
