import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import type { ProviderType } from './types.js';

export interface Settings {
  anthropic?: {
    apiKey: string;
    baseUrl?: string; // Custom API endpoint (e.g., https://api.z.ai/api/anthropic)
    model?: string; // Default model for this provider
  };
  openrouter?: {
    apiKey: string;
    baseUrl?: string; // Custom OpenRouter endpoint
    model?: string; // Default model for this provider
  };
  openai?: {
    apiKey: string;
    baseUrl?: string; // Custom OpenAI endpoint
    model?: string; // Default model for this provider
  };
  defaultProvider?: ProviderType;
  defaultModel?: string;
}

/**
 * Get settings directory path (in current working directory)
 */
export function getSettingsDir(): string {
  return join(process.cwd(), '.polish');
}

/**
 * Get settings file path
 */
export function getSettingsPath(): string {
  return join(getSettingsDir(), 'settings.json');
}

/**
 * Check if polish is initialized in current directory
 */
export function isInitialized(): boolean {
  return existsSync(getSettingsPath());
}

/**
 * Load settings from .polish/settings.json
 */
export function loadSettings(): Settings {
  const path = getSettingsPath();

  if (!existsSync(path)) {
    return {};
  }

  try {
    const content = readFileSync(path, 'utf-8');
    return JSON.parse(content) as Settings;
  } catch {
    return {};
  }
}

/**
 * Save settings to .polish/settings.json
 */
export function saveSettings(settings: Settings): void {
  const dir = getSettingsDir();

  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  writeFileSync(getSettingsPath(), JSON.stringify(settings, null, 2), 'utf-8');
}

/**
 * Initialize polish in current directory
 */
export function initPolish(settings: Settings): void {
  saveSettings(settings);

  // Add .polish to .gitignore if it exists
  const gitignorePath = join(process.cwd(), '.gitignore');
  if (existsSync(gitignorePath)) {
    const content = readFileSync(gitignorePath, 'utf-8');
    if (!content.includes('.polish')) {
      writeFileSync(gitignorePath, content + '\n.polish/\n', 'utf-8');
    }
  }
}

/**
 * Get API key for a provider
 */
export function getApiKey(provider: ProviderType): string | undefined {
  const settings = loadSettings();

  if (provider === 'anthropic') {
    return settings.anthropic?.apiKey ?? process.env.ANTHROPIC_API_KEY ?? process.env.ANTHROPIC_AUTH_TOKEN;
  }

  if (provider === 'openrouter') {
    return settings.openrouter?.apiKey ?? process.env.OPENROUTER_API_KEY;
  }

  if (provider === 'openai') {
    return settings.openai?.apiKey ?? process.env.OPENAI_API_KEY;
  }

  return undefined;
}

/**
 * Get base URL for a provider
 */
export function getBaseUrl(provider: ProviderType): string | undefined {
  const settings = loadSettings();

  if (provider === 'anthropic') {
    return settings.anthropic?.baseUrl ?? process.env.ANTHROPIC_BASE_URL;
  }

  if (provider === 'openrouter') {
    return settings.openrouter?.baseUrl ?? process.env.OPENROUTER_BASE_URL;
  }

  if (provider === 'openai') {
    return settings.openai?.baseUrl ?? process.env.OPENAI_BASE_URL;
  }

  return undefined;
}

/**
 * Get model for a provider
 */
export function getModel(provider: ProviderType): string | undefined {
  const settings = loadSettings();

  if (provider === 'anthropic') {
    return settings.anthropic?.model ?? settings.defaultModel;
  }

  if (provider === 'openrouter') {
    return settings.openrouter?.model ?? settings.defaultModel;
  }

  if (provider === 'openai') {
    return settings.openai?.model ?? settings.defaultModel;
  }

  return settings.defaultModel;
}
