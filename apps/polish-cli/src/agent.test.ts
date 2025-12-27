import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { writeFileSync, unlinkSync, existsSync, mkdirSync, rmSync } from 'fs';
import { join } from 'path';

// Note: We can't easily test runAgent without mocking the Anthropic API,
// but we can test the exported interface and ensure it exists
import { runAgent, runAgentWithCallback } from './agent.js';

describe('agent exports', () => {
  test('runAgent is exported and is a function', () => {
    expect(typeof runAgent).toBe('function');
  });

  test('runAgentWithCallback is exported and is a function', () => {
    expect(typeof runAgentWithCallback).toBe('function');
  });
});

// The following tests would require mocking the Anthropic API
// For now, we verify the module loads correctly and exports are available
describe('agent module structure', () => {
  test('module exports expected functions', async () => {
    const agent = await import('./agent.js');

    expect(agent).toHaveProperty('runAgent');
    expect(agent).toHaveProperty('runAgentWithCallback');
  });
});
