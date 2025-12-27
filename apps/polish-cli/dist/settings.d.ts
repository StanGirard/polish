import type { ProviderType } from './types.js';
export interface Settings {
    anthropic?: {
        apiKey: string;
        baseUrl?: string;
        model?: string;
    };
    openrouter?: {
        apiKey: string;
        baseUrl?: string;
        model?: string;
    };
    defaultProvider?: ProviderType;
    defaultModel?: string;
}
/**
 * Get settings directory path (in current working directory)
 */
export declare function getSettingsDir(): string;
/**
 * Get settings file path
 */
export declare function getSettingsPath(): string;
/**
 * Check if polish is initialized in current directory
 */
export declare function isInitialized(): boolean;
/**
 * Load settings from .polish/settings.json
 */
export declare function loadSettings(): Settings;
/**
 * Save settings to .polish/settings.json
 */
export declare function saveSettings(settings: Settings): void;
/**
 * Initialize polish in current directory
 */
export declare function initPolish(settings: Settings): void;
/**
 * Get API key for a provider
 */
export declare function getApiKey(provider: ProviderType): string | undefined;
/**
 * Get base URL for a provider
 */
export declare function getBaseUrl(provider: ProviderType): string | undefined;
/**
 * Get model for a provider
 */
export declare function getModel(provider: ProviderType): string | undefined;
