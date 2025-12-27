import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import type { PolishConfig, Metric, Provider } from './types.js';
import { loadSettings, getApiKey, getBaseUrl, getModel } from './settings.js';

// Default metrics when no config file exists
const DEFAULT_METRICS: Metric[] = [
  {
    name: 'tests',
    command: 'bun test',
    weight: 100,
    target: 100,
    higherIsBetter: true,
  },
];

const DEFAULT_PROVIDER: Provider = {
  type: 'anthropic',
  model: 'claude-sonnet-4.5',
};

const DEFAULT_CONFIG: PolishConfig = {
  metrics: DEFAULT_METRICS,
  target: 95,
  maxIterations: 50,
  provider: DEFAULT_PROVIDER,
};

export function loadConfig(configPath?: string): PolishConfig {
  const cwd = process.cwd();

  // Try explicit path first
  if (configPath) {
    const fullPath = join(cwd, configPath);
    if (existsSync(fullPath)) {
      return parseConfig(fullPath);
    }
    console.warn(`Config file not found: ${configPath}, using defaults`);
    return DEFAULT_CONFIG;
  }

  // Try default locations
  const defaultPaths = ['polish.config.json', '.polish.json', '.polish/polish.config.json'];

  for (const p of defaultPaths) {
    const fullPath = join(cwd, p);
    if (existsSync(fullPath)) {
      return parseConfig(fullPath);
    }
  }

  // No config found, use defaults
  return DEFAULT_CONFIG;
}

function parseConfig(path: string): PolishConfig {
  try {
    const content = readFileSync(path, 'utf-8');
    const parsed = JSON.parse(content) as Partial<PolishConfig>;

    // Merge with defaults
    return {
      metrics: parsed.metrics ?? DEFAULT_METRICS,
      target: parsed.target ?? DEFAULT_CONFIG.target,
      maxIterations: parsed.maxIterations ?? DEFAULT_CONFIG.maxIterations,
      provider: parsed.provider ?? DEFAULT_PROVIDER,
    };
  } catch (error) {
    console.error(`Error parsing config file: ${path}`, error);
    return DEFAULT_CONFIG;
  }
}

/**
 * Get the resolved provider config, merging CLI options with config file and settings
 * Priority: CLI options > .polish/settings.json > polish.config.json > defaults
 */
export function resolveProvider(
  config: PolishConfig,
  cliProvider?: string,
  cliModel?: string,
  cliBaseUrl?: string
): Provider {
  const settings = loadSettings();
  const configProvider = config.provider;

  // Determine provider type: CLI > settings > config > default
  const providerType = (cliProvider as Provider['type']) ?? settings.defaultProvider ?? configProvider?.type ?? 'anthropic';

  // Default models per provider
  const getDefaultModel = (provider: Provider['type']) => {
    switch (provider) {
      case 'openrouter':
        return 'anthropic/claude-opus-4.5';
      case 'openai':
        return 'gpt-4o';
      default:
        return 'claude-sonnet-4.5';
    }
  };
  const defaultModel = getDefaultModel(providerType);

  // Only use config model if provider types match (avoid using anthropic model for openrouter)
  const configModel = configProvider?.type === providerType ? configProvider?.model : undefined;

  return {
    type: providerType,
    model: cliModel ?? getModel(providerType) ?? configModel ?? defaultModel,
    apiKey: getApiKey(providerType) ?? configProvider?.apiKey,
    baseUrl: cliBaseUrl ?? getBaseUrl(providerType) ?? configProvider?.baseUrl,
  };
}
