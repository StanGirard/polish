#!/usr/bin/env node

import { Command } from 'commander';
import { installHook, uninstallHook, getHookStatus } from './hook-install.js';
import { loadState, resetState } from './state.js';
import { loadConfig, getConfigPath, saveConfig } from './config.js';
import { calculateScore } from './metrics.js';
import { initCommand } from './init/index.js';
import { addCommand } from './add.js';
import { listCommand, showCommand } from './bank.js';
import {
  getCommand,
  getBuiltinCommand,
  getCommandsByCategory,
  executeCommand,
  formatCommandResult,
  BUILTIN_COMMANDS,
} from './commands.js';
import type { CustomCommand } from './types.js';

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
  .option('--local', 'Install to settings.local.json instead of settings.json')
  .action(async (options) => {
    const result = await installHook(process.cwd(), options.local ?? false);
    if (result.success) {
      console.log('Polish hook installed');
      console.log(result.message);
      console.log('\nClaude Code will now run Polish metrics when it tries to stop.');
      console.log('If tests fail, Claude will continue fixing the code automatically.');
    } else {
      console.error('Failed to install hook:', result.message);
      process.exit(1);
    }
  });

hookCommand
  .command('uninstall')
  .description('Remove Polish hook from Claude Code')
  .option('--local', 'Uninstall from settings.local.json instead of settings.json')
  .action(async (options) => {
    const result = await uninstallHook(process.cwd(), options.local ?? false);
    if (result.success) {
      console.log('Polish hook uninstalled');
      console.log(result.message);
    } else {
      console.error('Failed to uninstall hook:', result.message);
      process.exit(1);
    }
  });

hookCommand
  .command('status')
  .description('Check if Polish hook is installed')
  .option('--local', 'Check settings.local.json instead of settings.json')
  .action(async (options) => {
    const status = await getHookStatus(process.cwd(), options.local ?? false);
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

// Init command - auto-detect and generate config
program
  .command('init')
  .description('Auto-detect project stack and generate polish.config.json')
  .option('-f, --force', 'Overwrite existing config')
  .option('-y, --yes', 'Skip interactive prompts, use detected defaults')
  .option('--dry-run', 'Show generated config without writing')
  .action(async (options) => {
    await initCommand(options);
  });

// Add command - add a verification to config
program
  .command('add <name>')
  .description('Add a verification to polish.config.json')
  .option('-w, --weight <number>', 'Override default weight')
  .option('-t, --target <number>', 'Override default target')
  .option('-c, --command <cmd>', 'Override default command')
  .action(async (name, options) => {
    await addCommand(name, options);
  });

// Bank subcommand - browse available verifications
const bankCommand = program
  .command('bank')
  .description('Browse available verifications');

bankCommand
  .command('list')
  .description('List all available verifications')
  .action(() => {
    listCommand();
  });

bankCommand
  .command('show <name>')
  .description('Show details about a verification')
  .action((name) => {
    showCommand(name);
  });

// Run command - execute a custom command
program
  .command('run <name>')
  .description('Run a command (built-in or custom)')
  .action(async (name) => {
    let config;
    try {
      config = loadConfig();
    } catch {
      // No config, only built-in commands available
    }

    const cmd = getCommand(name, config);
    if (!cmd) {
      console.error(`Command "${name}" not found.`);
      console.error('\nUse "polish commands list" to see available commands.');
      process.exit(1);
    }

    console.log(`Running: ${cmd.command}\n`);
    const result = await executeCommand(cmd);
    console.log(formatCommandResult(result, cmd));
    process.exit(result.success ? 0 : 1);
  });

// Commands subcommand - manage custom commands
const commandsCommand = program
  .command('commands')
  .description('Manage custom commands');

commandsCommand
  .command('list')
  .description('List all available commands (built-in and custom)')
  .option('-c, --category <cat>', 'Filter by category (test, lint, format, build, security, quality)')
  .action((options) => {
    let config;
    try {
      config = loadConfig();
    } catch {
      // No config, only built-in commands
    }

    const grouped = getCommandsByCategory(config);
    const categoryFilter = options.category?.toLowerCase();

    console.log('Available Commands');
    console.log('==================\n');

    // Category order
    const categoryOrder = ['test', 'lint', 'format', 'build', 'security', 'quality', 'other'];
    const categoryLabels: Record<string, string> = {
      test: '🧪 Test',
      lint: '🔍 Lint',
      format: '✨ Format',
      build: '🔨 Build',
      security: '🔒 Security',
      quality: '📊 Quality',
      other: '📦 Other',
    };

    for (const category of categoryOrder) {
      if (categoryFilter && category !== categoryFilter) continue;
      const commands = grouped[category];
      if (!commands || commands.length === 0) continue;

      console.log(`${categoryLabels[category] || category}`);
      console.log('-'.repeat(30));
      for (const cmd of commands) {
        const isCustom = config?.commands?.some(c => c.name === cmd.name);
        const suffix = isCustom ? ' (custom)' : '';
        console.log(`  ${cmd.name.padEnd(20)} ${cmd.description}${suffix}`);
      }
      console.log('');
    }

    // Show custom commands from config
    if (config?.commands && config.commands.length > 0) {
      const customOnly = config.commands.filter(
        c => !BUILTIN_COMMANDS[c.name]
      );
      if (customOnly.length > 0 && !categoryFilter) {
        console.log('📝 Custom (config)');
        console.log('-'.repeat(30));
        for (const cmd of customOnly) {
          console.log(`  ${cmd.name.padEnd(20)} ${cmd.description}`);
        }
        console.log('');
      }
    }

    console.log('Run a command: polish run <name>');
  });

commandsCommand
  .command('show <name>')
  .description('Show details about a command')
  .action((name) => {
    let config;
    try {
      config = loadConfig();
    } catch {
      // No config
    }

    const cmd = getCommand(name, config);
    if (!cmd) {
      console.error(`Command "${name}" not found.`);
      process.exit(1);
    }

    const isCustom = config?.commands?.some(c => c.name === name);
    const isOverride = isCustom && BUILTIN_COMMANDS[name];

    console.log(`Command: ${cmd.name}`);
    console.log('='.repeat(40));
    console.log(`Description: ${cmd.description}`);
    console.log(`Command:     ${cmd.command}`);
    console.log(`Category:    ${cmd.category || 'other'}`);
    if (isCustom) {
      console.log(`Source:      custom (polish.config.json)`);
    } else {
      console.log(`Source:      built-in`);
    }
    if (isOverride) {
      console.log(`Note:        Overrides built-in command`);
    }
    if (cmd.details) {
      console.log(`\nDetails:\n${cmd.details}`);
    }
    if (cmd.onError) {
      console.log(`\nOn Error:\n${cmd.onError}`);
    }
    console.log('\nRun with: polish run ' + name);
  });

commandsCommand
  .command('add <name>')
  .description('Add a command to polish.config.json')
  .requiredOption('-c, --command <cmd>', 'The shell command to run')
  .option('-d, --description <desc>', 'Description of the command')
  .option('--category <cat>', 'Category (test, lint, format, build, security, quality, other)')
  .option('--details <text>', 'Detailed explanation of what the command does')
  .option('--on-error <text>', 'Instructions on how to fix when it fails')
  .action(async (name, options) => {
    const configPath = getConfigPath();
    if (!configPath) {
      console.error('No polish.config.json found. Run "polish init" first.');
      process.exit(1);
    }

    const config = loadConfig();

    // Check if command already exists in config
    if (config.commands?.some(c => c.name === name)) {
      console.error(`Command "${name}" already exists in config.`);
      process.exit(1);
    }

    // Create the new command
    const newCommand: CustomCommand = {
      name,
      description: options.description || `Run ${name}`,
      command: options.command,
    };

    if (options.category) {
      newCommand.category = options.category;
    }
    if (options.details) {
      newCommand.details = options.details;
    }
    if (options.onError) {
      newCommand.onError = options.onError;
    }

    // Add to config
    config.commands = config.commands || [];
    config.commands.push(newCommand);

    // Save
    await saveConfig(config, configPath);

    console.log(`Added command "${name}" to ${configPath}`);
    console.log(`\nRun with: polish run ${name}`);
  });

program.parse();
