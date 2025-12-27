import { describe, test, expect, afterEach, beforeEach } from 'bun:test';
import { loadConfig, ConfigNotFoundError } from './config.js';
import { writeFileSync, unlinkSync, existsSync, renameSync } from 'fs';

describe('loadConfig', () => {
  const testConfigPath = 'test-polish.config.json';
  const polishConfigPath = 'polish.config.json';
  const dotPolishPath = '.polish.json';
  const dotPolishConfigPath = '.polish/polish.config.json';
  const dotPolishConfigBackup = '.polish/polish.config.json.bak';

  beforeEach(() => {
    // Backup existing .polish/polish.config.json if it exists
    if (existsSync(dotPolishConfigPath)) {
      renameSync(dotPolishConfigPath, dotPolishConfigBackup);
    }
  });

  afterEach(() => {
    // Clean up test files
    [testConfigPath, polishConfigPath, dotPolishPath].forEach((path) => {
      if (existsSync(path)) {
        unlinkSync(path);
      }
    });
    // Restore backup
    if (existsSync(dotPolishConfigBackup)) {
      renameSync(dotPolishConfigBackup, dotPolishConfigPath);
    }
  });

  test('throws ConfigNotFoundError when no config file exists', () => {
    expect(() => loadConfig('nonexistent.json')).toThrow(ConfigNotFoundError);
  });

  test('throws ConfigNotFoundError when no default config exists', () => {
    expect(() => loadConfig()).toThrow(ConfigNotFoundError);
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
      metrics: [{ name: 'tests', command: 'bun test', weight: 100, target: 100 }],
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
      metrics: [{ name: 'tests', command: 'bun test', weight: 100, target: 100 }],
      target: 70,
    };
    writeFileSync(dotPolishPath, JSON.stringify(testConfig));

    const config = loadConfig();

    expect(config.target).toBe(70);
  });

  test('uses default target and maxIterations when not specified', () => {
    const partialConfig = {
      metrics: [{ name: 'tests', command: 'bun test', weight: 100, target: 100 }],
    };
    writeFileSync(testConfigPath, JSON.stringify(partialConfig));

    const config = loadConfig(testConfigPath);

    expect(config.target).toBe(95); // default
    expect(config.maxIterations).toBe(50); // default
  });

  test('throws error when config has no metrics', () => {
    writeFileSync(testConfigPath, JSON.stringify({ target: 80 }));

    expect(() => loadConfig(testConfigPath)).toThrow('must define at least one metric');
  });

  test('throws error when config has empty metrics array', () => {
    writeFileSync(testConfigPath, JSON.stringify({ metrics: [], target: 80 }));

    expect(() => loadConfig(testConfigPath)).toThrow('must define at least one metric');
  });

  test('throws error on invalid JSON', () => {
    writeFileSync(testConfigPath, 'not valid json {{{');

    expect(() => loadConfig(testConfigPath)).toThrow();
  });
});
