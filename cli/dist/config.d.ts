import type { PolishConfig } from './types.js';
export declare class ConfigNotFoundError extends Error {
    constructor();
}
export declare function loadConfig(configPath?: string): PolishConfig;
/**
 * Get the path to an existing config file, or null if none exists
 */
export declare function getConfigPath(cwd?: string): string | null;
/**
 * Save config to a file
 */
export declare function saveConfig(config: PolishConfig, path: string): Promise<void>;
