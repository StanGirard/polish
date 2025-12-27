import type { PolishConfig, Provider } from './types.js';
export declare function loadConfig(configPath?: string): PolishConfig;
/**
 * Get the resolved provider config, merging CLI options with config file and settings
 * Priority: CLI options > .polish/settings.json > polish.config.json > defaults
 */
export declare function resolveProvider(config: PolishConfig, cliProvider?: string, cliModel?: string, cliBaseUrl?: string): Provider;
