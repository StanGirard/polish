#!/usr/bin/env node

import { Command } from 'commander';
import React from 'react';
import { render } from 'ink';
import { App } from './ui/App.js';
import { initPolish, isInitialized, type Settings } from './settings.js';
import { installHook, uninstallHook, getHookStatus } from './hook-install.js';
import { loadState, resetState } from './state.js';
import { loadConfig } from './config.js';
import { calculateScore } from './metrics.js';
import type { CliOptions, ProviderType } from './types.js';

const program = new Command();

program
  .name('polish')
  .description('Claude Code + Polish Loop - AI-powered code improvement')
  .version('0.1.0');

// Main command - run polish (legacy mode with built-in agent)
program
  .argument('[mission]', 'What to implement or improve')
  .option('--target <score>', 'Target score for polish loop (0-100)', '95')
  .option('--max-iterations <n>', 'Maximum polish iterations', '50')
  .option('--no-polish', 'Skip the polish loop (only implement)')
  .option('--polish-only', 'Only run polish loop on existing code')
  .option('--config <path>', 'Path to config file', 'polish.config.json')
  .option('--provider <provider>', 'AI provider: anthropic, openrouter, or openai')
  .option('--model <model>', 'Model to use (e.g., claude-sonnet-4.5 or anthropic/claude-sonnet-4.5)')
  .option('--base-url <url>', 'Custom API base URL (e.g., https://api.z.ai/api/anthropic)')
  .option('--init', 'Initialize polish in current directory')
  .option('--api-key <key>', 'API key for the provider (used with --init)')
  .action((mission: string | undefined, options: CliOptions & { init?: boolean; apiKey?: string }) => {
    // Handle --init flag for non-interactive initialization
    if (options.init) {
      const provider = (options.provider || 'anthropic') as ProviderType;
      const getEnvKeyName = (p: ProviderType) => {
        switch (p) {
          case 'anthropic': return 'ANTHROPIC_API_KEY';
          case 'openrouter': return 'OPENROUTER_API_KEY';
          case 'openai': return 'OPENAI_API_KEY';
        }
      };
      const getEnvBaseUrlName = (p: ProviderType) => {
        switch (p) {
          case 'anthropic': return 'ANTHROPIC_BASE_URL';
          case 'openrouter': return 'OPENROUTER_BASE_URL';
          case 'openai': return 'OPENAI_BASE_URL';
        }
      };
      const apiKey = options.apiKey || process.env[getEnvKeyName(provider)];
      const baseUrl = options.baseUrl || process.env[getEnvBaseUrlName(provider)];

      if (!apiKey) {
        console.error(`Error: API key required. Use --api-key or set ${getEnvKeyName(provider)} environment variable.`);
        process.exit(1);
      }

      const providerSettings: { apiKey: string; baseUrl?: string; model?: string } = { apiKey };
      if (baseUrl) {
        providerSettings.baseUrl = baseUrl;
      }
      if (options.model) {
        providerSettings.model = options.model;
      }

      const settings: Settings = {
        defaultProvider: provider,
        [provider]: providerSettings,
      };
      initPolish(settings);
      console.log('Polish initialized in current directory');
      console.log('Settings saved to .polish/settings.json');
      if (baseUrl) {
        console.log(`Using custom API endpoint: ${baseUrl}`);
      }
      if (options.model) {
        console.log(`Using model: ${options.model}`);
      }
      return;
    }

    // Check if initialized before starting the app
    if (!isInitialized()) {
      if (!process.stdin.isTTY) {
        console.error('Error: Polish not initialized. Run "polish --init --api-key YOUR_KEY" first.');
        process.exit(1);
      }
    }

    render(React.createElement(App, { mission, options }));
  });

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
    } else {
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
    } else {
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
