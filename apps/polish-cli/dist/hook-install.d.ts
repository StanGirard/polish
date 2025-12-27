/**
 * Hook installation utilities for Claude Code integration
 */
/**
 * Check if Polish hook is already installed
 */
export declare function isHookInstalled(cwd?: string): Promise<boolean>;
/**
 * Install the Polish Stop hook into Claude Code settings
 */
export declare function installHook(cwd?: string): Promise<{
    success: boolean;
    message: string;
}>;
/**
 * Uninstall the Polish Stop hook from Claude Code settings
 */
export declare function uninstallHook(cwd?: string): Promise<{
    success: boolean;
    message: string;
}>;
/**
 * Get hook status information
 */
export declare function getHookStatus(cwd?: string): Promise<{
    installed: boolean;
    settingsPath: string;
    settingsExists: boolean;
}>;
