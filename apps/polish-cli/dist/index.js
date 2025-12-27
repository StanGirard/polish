#!/usr/bin/env node
import { Command } from 'commander';
import React from 'react';
import { render } from 'ink';
import { App } from './ui/App.js';
import { initPolish, isInitialized } from './settings.js';
const program = new Command();
program
    .name('polish')
    .description('Claude Code + Polish Loop - AI-powered code improvement')
    .version('0.1.0')
    .argument('[mission]', 'What to implement or improve')
    .option('--target <score>', 'Target score for polish loop (0-100)', '95')
    .option('--max-iterations <n>', 'Maximum polish iterations', '50')
    .option('--no-polish', 'Skip the polish loop (only implement)')
    .option('--polish-only', 'Only run polish loop on existing code')
    .option('--config <path>', 'Path to config file', 'polish.config.json')
    .option('--provider <provider>', 'AI provider: anthropic or openrouter')
    .option('--model <model>', 'Model to use (e.g., claude-sonnet-4.5 or anthropic/claude-sonnet-4.5)')
    .option('--base-url <url>', 'Custom API base URL (e.g., https://api.z.ai/api/anthropic)')
    .option('--init', 'Initialize polish in current directory')
    .option('--api-key <key>', 'API key for the provider (used with --init)')
    .action((mission, options) => {
    // Handle --init flag for non-interactive initialization
    if (options.init) {
        const provider = (options.provider || 'anthropic');
        const apiKey = options.apiKey || process.env[provider === 'anthropic' ? 'ANTHROPIC_API_KEY' : 'OPENROUTER_API_KEY'];
        const baseUrl = options.baseUrl || process.env[provider === 'anthropic' ? 'ANTHROPIC_BASE_URL' : 'OPENROUTER_BASE_URL'];
        if (!apiKey) {
            console.error(`Error: API key required. Use --api-key or set ${provider === 'anthropic' ? 'ANTHROPIC_API_KEY' : 'OPENROUTER_API_KEY'} environment variable.`);
            process.exit(1);
        }
        const providerSettings = { apiKey };
        if (baseUrl) {
            providerSettings.baseUrl = baseUrl;
        }
        if (options.model) {
            providerSettings.model = options.model;
        }
        const settings = {
            defaultProvider: provider,
            [provider]: providerSettings,
        };
        initPolish(settings);
        console.log('✓ Polish initialized in current directory');
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
program.parse();
