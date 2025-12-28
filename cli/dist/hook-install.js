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
 * @param cwd - Working directory
 * @param local - If true, use settings.local.json (not committed to git), otherwise settings.json (shared)
 */
function getClaudeSettingsPath(cwd = process.cwd(), local = false) {
    const filename = local ? 'settings.local.json' : 'settings.json';
    return path.join(cwd, '.claude', filename);
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
 * @param cwd - Working directory
 * @param local - If true, check settings.local.json, otherwise settings.json
 */
export async function isHookInstalled(cwd = process.cwd(), local = false) {
    const settingsPath = getClaudeSettingsPath(cwd, local);
    const settings = await loadClaudeSettings(settingsPath);
    const stopMatchers = settings.hooks?.Stop;
    if (!stopMatchers)
        return false;
    // Check nested hooks arrays
    for (const matcher of stopMatchers) {
        if (!matcher.hooks)
            continue;
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
 * @param cwd - Working directory
 * @param local - If true, install to settings.local.json, otherwise settings.json
 */
export async function installHook(cwd = process.cwd(), local = false) {
    const settingsPath = getClaudeSettingsPath(cwd, local);
    const settings = await loadClaudeSettings(settingsPath);
    // Check if already installed
    if (await isHookInstalled(cwd, local)) {
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
    // Add our hook with correct nested structure per Claude Code docs
    const polishHook = {
        type: 'command',
        command: HOOK_COMMAND,
        timeout: HOOK_TIMEOUT,
    };
    // Wrap in matcher object with hooks array
    const hookMatcher = {
        hooks: [polishHook],
    };
    settings.hooks.Stop.push(hookMatcher);
    await saveClaudeSettings(settingsPath, settings);
    return {
        success: true,
        message: `Polish hook installed to ${settingsPath}`,
    };
}
/**
 * Uninstall the Polish Stop hook from Claude Code settings
 * @param cwd - Working directory
 * @param local - If true, uninstall from settings.local.json, otherwise settings.json
 */
export async function uninstallHook(cwd = process.cwd(), local = false) {
    const settingsPath = getClaudeSettingsPath(cwd, local);
    if (!existsSync(settingsPath)) {
        return { success: true, message: 'No Claude Code settings found' };
    }
    const settings = await loadClaudeSettings(settingsPath);
    if (!settings.hooks?.Stop) {
        return { success: true, message: 'No Stop hooks configured' };
    }
    // Filter out matchers that contain our hook
    settings.hooks.Stop = settings.hooks.Stop.filter((matcher) => {
        if (!matcher.hooks)
            return true;
        // Remove Polish hook from this matcher's hooks array
        matcher.hooks = matcher.hooks.filter((hook) => {
            return !(hook.type === 'command' && hook.command === HOOK_COMMAND);
        });
        // Keep the matcher only if it still has hooks
        return matcher.hooks.length > 0;
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
 * @param cwd - Working directory
 * @param local - If true, check settings.local.json, otherwise settings.json
 */
export async function getHookStatus(cwd = process.cwd(), local = false) {
    const settingsPath = getClaudeSettingsPath(cwd, local);
    const settingsExists = existsSync(settingsPath);
    const installed = await isHookInstalled(cwd, local);
    return {
        installed,
        settingsPath,
        settingsExists,
    };
}
