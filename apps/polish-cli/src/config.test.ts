import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { loadConfig, resolveProvider } from './config.js';
import { writeFileSync, unlinkSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import type { PolishConfig } from './types.js';

describe('loadConfig', () => {
  const testConfigPath = 'test-polish.config.json';
  const polishConfigPath = 'polish.config.json';
  const dotPolishPath = '.polish.json';

  afterEach(() => {
    // Clean up test files
    [testConfigPath, polishConfigPath, dotPolishPath].forEach((path) => {
      if (existsSync(path)) {
        unlinkSync(path);
      }
    });
  });

  test('returns default config when no config file exists', () => {
    const config = loadConfig('nonexistent.json');

    expect(config.target).toBe(95);
    expect(config.maxIterations).toBe(50);
    expect(config.metrics).toHaveLength(1);
    expect(config.metrics[0].name).toBe('tests');
    expect(config.provider?.type).toBe('anthropic');
  });

  test('loads config from explicit path', () => {
    const testConfig = {
      metrics: [{ name: 'custom', command: 'echo test', weight: 50, target: 80 }],
      target: 90,
      maxIterations: 10,
    };
    writeFileSync(testConfigPath, JSON.stringify(testConfig));

    const config = loadConfig(testConfigPath);

    expect(config.target).toBe(90);
    expect(config.maxIterations).toBe(10);
    expect(config.metrics[0].name).toBe('custom');
  });

  test('loads config from polish.config.json by default', () => {
    const testConfig = {
      target: 85,
      maxIterations: 25,
    };
    writeFileSync(polishConfigPath, JSON.stringify(testConfig));

    const config = loadConfig();

    expect(config.target).toBe(85);
    expect(config.maxIterations).toBe(25);
  });

  test('loads config from .polish.json as fallback', () => {
    const testConfig = {
      target: 70,
    };
    writeFileSync(dotPolishPath, JSON.stringify(testConfig));

    const config = loadConfig();

    expect(config.target).toBe(70);
  });

  test('merges partial config with defaults', () => {
    const partialConfig = {
      target: 80,
    };
    writeFileSync(testConfigPath, JSON.stringify(partialConfig));

    const config = loadConfig(testConfigPath);

    expect(config.target).toBe(80);
    expect(config.maxIterations).toBe(50); // default
    expect(config.metrics).toHaveLength(1); // default
  });

  test('handles invalid JSON gracefully', () => {
    writeFileSync(testConfigPath, 'not valid json {{{');

    const config = loadConfig(testConfigPath);

    // Should return defaults
    expect(config.target).toBe(95);
    expect(config.maxIterations).toBe(50);
  });
});

describe('resolveProvider', () => {
  const settingsDir = '.polish';
  const settingsPath = join(settingsDir, 'settings.json');

  beforeEach(() => {
    // Clean up settings
    if (existsSync(settingsPath)) {
      unlinkSync(settingsPath);
    }
  });

  afterEach(() => {
    // Only delete settings.json, preserve hook.log and other files
    if (existsSync(settingsPath)) {
      unlinkSync(settingsPath);
    }
  });

  test('uses config provider when no CLI options', () => {
    const config: PolishConfig = {
      metrics: [],
      target: 95,
      maxIterations: 50,
      provider: {
        type: 'openai',
        model: 'gpt-4',
      },
    };

    const provider = resolveProvider(config);

    expect(provider.type).toBe('openai');
    expect(provider.model).toBe('gpt-4');
  });

  test('CLI options override config', () => {
    const config: PolishConfig = {
      metrics: [],
      target: 95,
      maxIterations: 50,
      provider: {
        type: 'openai',
        model: 'gpt-4',
      },
    };

    const provider = resolveProvider(config, 'anthropic', 'claude-opus-4');

    expect(provider.type).toBe('anthropic');
    expect(provider.model).toBe('claude-opus-4');
  });

  test('returns default anthropic provider when nothing specified', () => {
    const config: PolishConfig = {
      metrics: [],
      target: 95,
      maxIterations: 50,
    };

    const provider = resolveProvider(config);

    expect(provider.type).toBe('anthropic');
    expect(provider.model).toBe('claude-sonnet-4.5');
  });

  test('sets correct default model for openrouter', () => {
    const config: PolishConfig = {
      metrics: [],
      target: 95,
      maxIterations: 50,
    };

    const provider = resolveProvider(config, 'openrouter');

    expect(provider.type).toBe('openrouter');
    expect(provider.model).toBe('anthropic/claude-opus-4.5');
  });

  test('sets correct default model for openai', () => {
    const config: PolishConfig = {
      metrics: [],
      target: 95,
      maxIterations: 50,
    };

    const provider = resolveProvider(config, 'openai');

    expect(provider.type).toBe('openai');
    expect(provider.model).toBe('gpt-4o');
  });

  test('CLI baseUrl overrides config', () => {
    const config: PolishConfig = {
      metrics: [],
      target: 95,
      maxIterations: 50,
      provider: {
        type: 'anthropic',
        baseUrl: 'https://config.url',
      },
    };

    const provider = resolveProvider(config, undefined, undefined, 'https://cli.url');

    expect(provider.baseUrl).toBe('https://cli.url');
  });
});
