/**
 * Hook installation utilities for Claude Code integration
 */
/**
 * Check if Polish hook is already installed
 * @param cwd - Working directory
 * @param local - If true, check settings.local.json, otherwise settings.json
 */
export declare function isHookInstalled(cwd?: string, local?: boolean): Promise<boolean>;
/**
 * Install the Polish Stop hook into Claude Code settings
 * @param cwd - Working directory
 * @param local - If true, install to settings.local.json, otherwise settings.json
 */
export declare function installHook(cwd?: string, local?: boolean): Promise<{
    success: boolean;
    message: string;
}>;
/**
 * Uninstall the Polish Stop hook from Claude Code settings
 * @param cwd - Working directory
 * @param local - If true, uninstall from settings.local.json, otherwise settings.json
 */
export declare function uninstallHook(cwd?: string, local?: boolean): Promise<{
    success: boolean;
    message: string;
}>;
/**
 * Get hook status information
 * @param cwd - Working directory
 * @param local - If true, check settings.local.json, otherwise settings.json
 */
export declare function getHookStatus(cwd?: string, local?: boolean): Promise<{
    installed: boolean;
    settingsPath: string;
    settingsExists: boolean;
}>;
