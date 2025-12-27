import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import type { PolishConfig } from './types.js';

const DEFAULT_TARGET = 95;
const DEFAULT_MAX_ITERATIONS = 50;

export class ConfigNotFoundError extends Error {
  constructor() {
    super(
      'No polish.config.json found. Create one with your metrics:\n\n' +
      '{\n' +
      '  "metrics": [\n' +
      '    { "name": "tests", "command": "bun test", "weight": 100, "target": 100 }\n' +
      '  ],\n' +
      '  "target": 95\n' +
      '}\n\n' +
      'See examples/polish.config.json for more metric examples.'
    );
    this.name = 'ConfigNotFoundError';
  }
}

export function loadConfig(configPath?: string): PolishConfig {
  const cwd = process.cwd();

  // Try explicit path first
  if (configPath) {
    const fullPath = join(cwd, configPath);
    if (existsSync(fullPath)) {
      return parseConfig(fullPath);
    }
    throw new ConfigNotFoundError();
  }

  // Try default locations
  const defaultPaths = ['polish.config.json', '.polish.json', '.polish/polish.config.json'];

  for (const p of defaultPaths) {
    const fullPath = join(cwd, p);
    if (existsSync(fullPath)) {
      return parseConfig(fullPath);
    }
  }

  // No config found
  throw new ConfigNotFoundError();
}

function parseConfig(path: string): PolishConfig {
  const content = readFileSync(path, 'utf-8');
  const parsed = JSON.parse(content) as Partial<PolishConfig>;

  if (!parsed.metrics || parsed.metrics.length === 0) {
    throw new Error(`Config file ${path} must define at least one metric`);
  }

  return {
    metrics: parsed.metrics,
    target: parsed.target ?? DEFAULT_TARGET,
    maxIterations: parsed.maxIterations ?? DEFAULT_MAX_ITERATIONS,
  };
}
