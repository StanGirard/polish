import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import {
  getSettingsDir,
  getSettingsPath,
  isInitialized,
  loadSettings,
  saveSettings,
  getApiKey,
  getBaseUrl,
  getModel,
} from './settings.js';
import { writeFileSync, unlinkSync, existsSync, mkdirSync, rmSync } from 'fs';
import { join } from 'path';

describe('settings paths', () => {
  test('getSettingsDir returns .polish directory', () => {
    const dir = getSettingsDir();
    expect(dir).toContain('.polish');
    expect(dir.endsWith('.polish')).toBe(true);
  });

  test('getSettingsPath returns settings.json in .polish directory', () => {
    const path = getSettingsPath();
    expect(path).toContain('.polish');
    expect(path.endsWith('settings.json')).toBe(true);
  });
});

describe('isInitialized', () => {
  const settingsDir = '.polish';
  const settingsPath = join(settingsDir, 'settings.json');

  afterEach(() => {
    if (existsSync(settingsPath)) {
      unlinkSync(settingsPath);
    }
    if (existsSync(settingsDir)) {
      rmSync(settingsDir, { recursive: true });
    }
  });

  test('returns false when settings file does not exist', () => {
    if (existsSync(settingsPath)) {
      unlinkSync(settingsPath);
    }
    expect(isInitialized()).toBe(false);
  });

  test('returns true when settings file exists', () => {
    if (!existsSync(settingsDir)) {
      mkdirSync(settingsDir, { recursive: true });
    }
    writeFileSync(settingsPath, '{}');
    expect(isInitialized()).toBe(true);
  });
});

describe('loadSettings', () => {
  const settingsDir = '.polish';
  const settingsPath = join(settingsDir, 'settings.json');

  afterEach(() => {
    if (existsSync(settingsPath)) {
      unlinkSync(settingsPath);
    }
    if (existsSync(settingsDir)) {
      rmSync(settingsDir, { recursive: true });
    }
  });

  test('returns empty object when no settings file exists', () => {
    const settings = loadSettings();
    expect(settings).toEqual({});
  });

  test('loads settings from file', () => {
    if (!existsSync(settingsDir)) {
      mkdirSync(settingsDir, { recursive: true });
    }
    const testSettings = {
      anthropic: { apiKey: 'test-key' },
      defaultProvider: 'anthropic',
    };
    writeFileSync(settingsPath, JSON.stringify(testSettings));

    const settings = loadSettings();

    expect(settings.anthropic?.apiKey).toBe('test-key');
    expect(settings.defaultProvider).toBe('anthropic');
  });

  test('returns empty object on invalid JSON', () => {
    if (!existsSync(settingsDir)) {
      mkdirSync(settingsDir, { recursive: true });
    }
    writeFileSync(settingsPath, 'invalid json');

    const settings = loadSettings();
    expect(settings).toEqual({});
  });
});

describe('saveSettings', () => {
  const settingsDir = '.polish';
  const settingsPath = join(settingsDir, 'settings.json');

  afterEach(() => {
    if (existsSync(settingsPath)) {
      unlinkSync(settingsPath);
    }
    if (existsSync(settingsDir)) {
      rmSync(settingsDir, { recursive: true });
    }
  });

  test('creates .polish directory if it does not exist', () => {
    if (existsSync(settingsDir)) {
      rmSync(settingsDir, { recursive: true });
    }

    saveSettings({ defaultProvider: 'anthropic' });

    expect(existsSync(settingsDir)).toBe(true);
    expect(existsSync(settingsPath)).toBe(true);
  });

  test('saves settings to file', () => {
    const testSettings = {
      anthropic: { apiKey: 'saved-key' },
      openai: { apiKey: 'openai-key', baseUrl: 'https://custom.url' },
    };

    saveSettings(testSettings);

    const loaded = loadSettings();
    expect(loaded.anthropic?.apiKey).toBe('saved-key');
    expect(loaded.openai?.apiKey).toBe('openai-key');
    expect(loaded.openai?.baseUrl).toBe('https://custom.url');
  });
});

describe('getApiKey', () => {
  const settingsDir = '.polish';
  const settingsPath = join(settingsDir, 'settings.json');
  const originalEnv = { ...process.env };

  beforeEach(() => {
    // Reset env
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_AUTH_TOKEN;
    delete process.env.OPENROUTER_API_KEY;
    delete process.env.OPENAI_API_KEY;
  });

  afterEach(() => {
    if (existsSync(settingsPath)) {
      unlinkSync(settingsPath);
    }
    if (existsSync(settingsDir)) {
      rmSync(settingsDir, { recursive: true });
    }
    // Restore env
    Object.assign(process.env, originalEnv);
  });

  test('returns API key from settings for anthropic', () => {
    if (!existsSync(settingsDir)) {
      mkdirSync(settingsDir, { recursive: true });
    }
    writeFileSync(settingsPath, JSON.stringify({ anthropic: { apiKey: 'settings-key' } }));

    expect(getApiKey('anthropic')).toBe('settings-key');
  });

  test('falls back to ANTHROPIC_API_KEY env var', () => {
    process.env.ANTHROPIC_API_KEY = 'env-key';

    expect(getApiKey('anthropic')).toBe('env-key');
  });

  test('falls back to ANTHROPIC_AUTH_TOKEN env var', () => {
    process.env.ANTHROPIC_AUTH_TOKEN = 'auth-token';

    expect(getApiKey('anthropic')).toBe('auth-token');
  });

  test('returns API key for openrouter from settings', () => {
    if (!existsSync(settingsDir)) {
      mkdirSync(settingsDir, { recursive: true });
    }
    writeFileSync(settingsPath, JSON.stringify({ openrouter: { apiKey: 'or-key' } }));

    expect(getApiKey('openrouter')).toBe('or-key');
  });

  test('returns API key for openai from settings', () => {
    if (!existsSync(settingsDir)) {
      mkdirSync(settingsDir, { recursive: true });
    }
    writeFileSync(settingsPath, JSON.stringify({ openai: { apiKey: 'oai-key' } }));

    expect(getApiKey('openai')).toBe('oai-key');
  });

  test('returns undefined for unknown provider', () => {
    // @ts-expect-error testing unknown provider
    expect(getApiKey('unknown')).toBeUndefined();
  });
});

describe('getBaseUrl', () => {
  const settingsDir = '.polish';
  const settingsPath = join(settingsDir, 'settings.json');
  const originalEnv = { ...process.env };

  beforeEach(() => {
    delete process.env.ANTHROPIC_BASE_URL;
    delete process.env.OPENROUTER_BASE_URL;
    delete process.env.OPENAI_BASE_URL;
  });

  afterEach(() => {
    if (existsSync(settingsPath)) {
      unlinkSync(settingsPath);
    }
    if (existsSync(settingsDir)) {
      rmSync(settingsDir, { recursive: true });
    }
    Object.assign(process.env, originalEnv);
  });

  test('returns base URL from settings', () => {
    if (!existsSync(settingsDir)) {
      mkdirSync(settingsDir, { recursive: true });
    }
    writeFileSync(
      settingsPath,
      JSON.stringify({ anthropic: { apiKey: 'key', baseUrl: 'https://custom.anthropic' } })
    );

    expect(getBaseUrl('anthropic')).toBe('https://custom.anthropic');
  });

  test('falls back to environment variable', () => {
    process.env.OPENAI_BASE_URL = 'https://env.openai';

    expect(getBaseUrl('openai')).toBe('https://env.openai');
  });
});

describe('getModel', () => {
  const settingsDir = '.polish';
  const settingsPath = join(settingsDir, 'settings.json');

  afterEach(() => {
    if (existsSync(settingsPath)) {
      unlinkSync(settingsPath);
    }
    if (existsSync(settingsDir)) {
      rmSync(settingsDir, { recursive: true });
    }
  });

  test('returns model from provider-specific settings', () => {
    if (!existsSync(settingsDir)) {
      mkdirSync(settingsDir, { recursive: true });
    }
    writeFileSync(
      settingsPath,
      JSON.stringify({ anthropic: { apiKey: 'key', model: 'claude-opus-4' } })
    );

    expect(getModel('anthropic')).toBe('claude-opus-4');
  });

  test('falls back to defaultModel', () => {
    if (!existsSync(settingsDir)) {
      mkdirSync(settingsDir, { recursive: true });
    }
    writeFileSync(settingsPath, JSON.stringify({ defaultModel: 'default-model' }));

    expect(getModel('anthropic')).toBe('default-model');
  });

  test('returns undefined when no model configured', () => {
    expect(getModel('anthropic')).toBeUndefined();
  });
});
