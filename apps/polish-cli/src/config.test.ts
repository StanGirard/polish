import { describe, test, expect, afterEach } from 'bun:test';
import { loadConfig } from './config.js';
import { writeFileSync, unlinkSync, existsSync } from 'fs';

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
