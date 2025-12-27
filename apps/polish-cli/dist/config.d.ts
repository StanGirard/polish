import type { PolishConfig } from './types.js';
export declare class ConfigNotFoundError extends Error {
    constructor();
}
export declare function loadConfig(configPath?: string): PolishConfig;
