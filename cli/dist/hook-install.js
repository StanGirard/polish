/**
 * Hook installation utilities for Claude Code integration
 */
import * as fs from 'fs/promises';
import * as path from 'path';
import { existsSync } from 'fs';
const HOOK_COMMAND = 'polish-hook';
const HOOK_TIMEOUT = 120; // 2 minutes for running tests
/**
 * Get the path to Claude Code settings file
 * Uses .claude/settings.local.json for project-specific settings
 */
function getClaudeSettingsPath(cwd = process.cwd()) {
    return path.join(cwd, '.claude', 'settings.local.json');
}
/**
 * Load existing Claude Code settings
 */
async function loadClaudeSettings(settingsPath) {
    try {
        const content = await fs.readFile(settingsPath, 'utf-8');
        return JSON.parse(content);
    }
    catch {
        return {};
    }
}
/**
 * Save Claude Code settings
 */
async function saveClaudeSettings(settingsPath, settings) {
    // Ensure directory exists
    const dir = path.dirname(settingsPath);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(settingsPath, JSON.stringify(settings, null, 2));
}
/**
 * Check if Polish hook is already installed
 */
export async function isHookInstalled(cwd = process.cwd()) {
    const settingsPath = getClaudeSettingsPath(cwd);
    const settings = await loadClaudeSettings(settingsPath);
    const stopHooks = settings.hooks?.Stop;
    if (!stopHooks)
        return false;
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
export async function installHook(cwd = process.cwd()) {
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
    const polishHook = {
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
export async function uninstallHook(cwd = process.cwd()) {
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
        const hasOurHook = matcher.hooks.some((hook) => hook.type === 'command' && hook.command === HOOK_COMMAND);
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
export async function getHookStatus(cwd = process.cwd()) {
    const settingsPath = getClaudeSettingsPath(cwd);
    const settingsExists = existsSync(settingsPath);
    const installed = await isHookInstalled(cwd);
    return {
        installed,
        settingsPath,
        settingsExists,
    };
}
