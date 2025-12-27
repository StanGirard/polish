/**
 * Hook installation utilities for Claude Code integration
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { existsSync } from 'fs';

interface ClaudeCodeHook {
  type: 'command' | 'prompt';
  command?: string;
  prompt?: string;
  timeout?: number;
}

interface ClaudeCodeHookMatcher {
  matcher?: string;
  hooks: ClaudeCodeHook[];
}

interface ClaudeCodeSettings {
  hooks?: {
    [eventName: string]: ClaudeCodeHookMatcher[];
  };
  [key: string]: unknown;
}

const HOOK_COMMAND = 'polish-hook';
const HOOK_TIMEOUT = 120; // 2 minutes for running tests

/**
 * Get the path to Claude Code settings file
 * Uses .claude/settings.local.json for project-specific settings
 */
function getClaudeSettingsPath(cwd: string = process.cwd()): string {
  return path.join(cwd, '.claude', 'settings.local.json');
}

/**
 * Load existing Claude Code settings
 */
async function loadClaudeSettings(settingsPath: string): Promise<ClaudeCodeSettings> {
  try {
    const content = await fs.readFile(settingsPath, 'utf-8');
    return JSON.parse(content) as ClaudeCodeSettings;
  } catch {
    return {};
  }
}

/**
 * Save Claude Code settings
 */
async function saveClaudeSettings(settingsPath: string, settings: ClaudeCodeSettings): Promise<void> {
  // Ensure directory exists
  const dir = path.dirname(settingsPath);
  await fs.mkdir(dir, { recursive: true });

  await fs.writeFile(settingsPath, JSON.stringify(settings, null, 2));
}

/**
 * Check if Polish hook is already installed
 */
export async function isHookInstalled(cwd: string = process.cwd()): Promise<boolean> {
  const settingsPath = getClaudeSettingsPath(cwd);
  const settings = await loadClaudeSettings(settingsPath);

  const stopHooks = settings.hooks?.Stop;
  if (!stopHooks) return false;

  for (const matcher of stopHooks) {
    for (const hook of matcher.hooks) {
      if (hook.type === 'command' && hook.command === HOOK_COMMAND) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Install the Polish Stop hook into Claude Code settings
 */
export async function installHook(cwd: string = process.cwd()): Promise<{ success: boolean; message: string }> {
  const settingsPath = getClaudeSettingsPath(cwd);
  const settings = await loadClaudeSettings(settingsPath);

  // Check if already installed
  if (await isHookInstalled(cwd)) {
    return { success: true, message: 'Polish hook is already installed' };
  }

  // Create hooks structure if it doesn't exist
  if (!settings.hooks) {
    settings.hooks = {};
  }

  // Create Stop hooks array if it doesn't exist
  if (!settings.hooks.Stop) {
    settings.hooks.Stop = [];
  }

  // Add our hook
  const polishHook: ClaudeCodeHookMatcher = {
    hooks: [
      {
        type: 'command',
        command: HOOK_COMMAND,
        timeout: HOOK_TIMEOUT,
      },
    ],
  };

  settings.hooks.Stop.push(polishHook);

  await saveClaudeSettings(settingsPath, settings);

  return {
    success: true,
    message: `Polish hook installed to ${settingsPath}`,
  };
}

/**
 * Uninstall the Polish Stop hook from Claude Code settings
 */
export async function uninstallHook(cwd: string = process.cwd()): Promise<{ success: boolean; message: string }> {
  const settingsPath = getClaudeSettingsPath(cwd);

  if (!existsSync(settingsPath)) {
    return { success: true, message: 'No Claude Code settings found' };
  }

  const settings = await loadClaudeSettings(settingsPath);

  if (!settings.hooks?.Stop) {
    return { success: true, message: 'No Stop hooks configured' };
  }

  // Filter out our hook
  settings.hooks.Stop = settings.hooks.Stop.filter((matcher) => {
    // Keep matchers that don't contain our hook
    const hasOurHook = matcher.hooks.some(
      (hook) => hook.type === 'command' && hook.command === HOOK_COMMAND
    );
    return !hasOurHook;
  });

  // Clean up empty arrays
  if (settings.hooks.Stop.length === 0) {
    delete settings.hooks.Stop;
  }
  if (Object.keys(settings.hooks).length === 0) {
    delete settings.hooks;
  }

  await saveClaudeSettings(settingsPath, settings);

  return {
    success: true,
    message: 'Polish hook uninstalled',
  };
}

/**
 * Get hook status information
 */
export async function getHookStatus(cwd: string = process.cwd()): Promise<{
  installed: boolean;
  settingsPath: string;
  settingsExists: boolean;
}> {
  const settingsPath = getClaudeSettingsPath(cwd);
  const settingsExists = existsSync(settingsPath);
  const installed = await isHookInstalled(cwd);

  return {
    installed,
    settingsPath,
    settingsExists,
  };
}
