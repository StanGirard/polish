import { join } from 'path';
import { checkbox } from '@inquirer/prompts';
import { saveConfig, getConfigPath } from '../config.js';
import { getMatchingVerifications, getAllVerifications, verificationToMetric, } from '../verifications/index.js';
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
    console.log('Detecting project verifications...\n');
    // Get matching verifications for this project
    const matching = await getMatchingVerifications(cwd);
    if (matching.length === 0) {
        console.error('No verifications matched your project.');
        console.error('Make sure you have one of: package.json, pyproject.toml, Cargo.toml, go.mod, pom.xml, build.gradle');
        process.exit(1);
    }
    console.log('Found matching verifications:');
    for (const v of matching) {
        console.log(`  - ${v.name} (${v.category})`);
    }
    console.log('');
    // Build choices for interactive selection
    const matchingIds = new Set(matching.map(v => v.id));
    const all = getAllVerifications();
    const choices = all.map(v => ({
        name: `${v.id.padEnd(16)} - ${v.description}`,
        value: v.id,
        checked: matchingIds.has(v.id),
    }));
    let selectedIds;
    if (options.yes) {
        selectedIds = matching.map(v => v.id);
        console.log('Using detected verifications (--yes flag).\n');
    }
    else {
        console.log('Select verifications to include:\n');
        selectedIds = await checkbox({
            message: 'Verifications',
            choices,
            pageSize: 15,
        });
    }
    if (selectedIds.length === 0) {
        console.error('\nNo verifications selected. Aborting.');
        process.exit(1);
    }
    // Build metrics from selections
    const metrics = selectedIds
        .map(id => all.find(v => v.id === id))
        .filter((v) => v !== undefined)
        .map(verificationToMetric);
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
}
