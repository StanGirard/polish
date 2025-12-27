#!/usr/bin/env node
import { Command } from 'commander';
import { installHook, uninstallHook, getHookStatus } from './hook-install.js';
import { loadState, resetState } from './state.js';
import { loadConfig } from './config.js';
import { calculateScore } from './metrics.js';
const program = new Command();
program
    .name('polish')
    .description('Code quality enforcement via Claude Code hooks')
    .version('0.2.0');
// Hook subcommand
const hookCommand = program
    .command('hook')
    .description('Manage Claude Code hook integration');
hookCommand
    .command('install')
    .description('Install Polish as a Claude Code Stop hook')
    .action(async () => {
    const result = await installHook();
    if (result.success) {
        console.log('Polish hook installed');
        console.log(result.message);
        console.log('\nClaude Code will now run Polish metrics when it tries to stop.');
        console.log('If tests fail, Claude will continue fixing the code automatically.');
    }
    else {
        console.error('Failed to install hook:', result.message);
        process.exit(1);
    }
});
hookCommand
    .command('uninstall')
    .description('Remove Polish hook from Claude Code')
    .action(async () => {
    const result = await uninstallHook();
    if (result.success) {
        console.log('Polish hook uninstalled');
        console.log(result.message);
    }
    else {
        console.error('Failed to uninstall hook:', result.message);
        process.exit(1);
    }
});
hookCommand
    .command('status')
    .description('Check if Polish hook is installed')
    .action(async () => {
    const status = await getHookStatus();
    console.log('Polish Hook Status');
    console.log('------------------');
    console.log(`Installed: ${status.installed ? 'Yes' : 'No'}`);
    console.log(`Settings file: ${status.settingsPath}`);
    console.log(`Settings exists: ${status.settingsExists ? 'Yes' : 'No'}`);
});
// Status command - show current polish state
program
    .command('status')
    .description('Show current polish session status')
    .action(async () => {
    const config = loadConfig();
    const state = await loadState();
    const score = await calculateScore(config.metrics);
    console.log('Polish Status');
    console.log('-------------');
    console.log(`Target: ${config.target}`);
    console.log(`Current Score: ${score.total}`);
    console.log(`Iteration: ${state.iteration}`);
    console.log(`Stalled Count: ${state.stalledCount}`);
    console.log(`Last Improvement: Iteration ${state.lastImprovement}`);
    console.log('');
    console.log('Metrics:');
    for (const metric of score.metrics) {
        const status = metric.score >= metric.target ? '[OK]' : '[  ]';
        console.log(`  ${status} ${metric.name}: ${metric.score}/${metric.target}`);
    }
});
// Reset command - clear polish state
program
    .command('reset')
    .description('Reset polish session state')
    .action(async () => {
    await resetState();
    console.log('Polish state reset');
});
program.parse();
