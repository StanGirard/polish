import { readFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { parse as parseYaml } from 'yaml';
import type { Verification, Condition, ScoringConfig } from './types.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Raw YAML structure before normalization
 */
interface RawVerification {
  name: string;
  description?: string;
  category?: string;
  command: string;
  conditions?: unknown[];
  scoring?: unknown;
  weight?: number;
  target?: number;
  onError?: string;
}

/**
 * Parse a condition from YAML
 */
function parseCondition(raw: unknown): Condition | null {
  if (!raw || typeof raw !== 'object') return null;

  const obj = raw as Record<string, unknown>;

  if ('fileExists' in obj && typeof obj.fileExists === 'string') {
    return { fileExists: obj.fileExists };
  }

  if ('fileContains' in obj && typeof obj.fileContains === 'object') {
    const fc = obj.fileContains as Record<string, unknown>;
    if (typeof fc.path === 'string' && typeof fc.pattern === 'string') {
      return { fileContains: { path: fc.path, pattern: fc.pattern } };
    }
  }

  if ('anyOf' in obj && Array.isArray(obj.anyOf)) {
    const nested = obj.anyOf
      .map(parseCondition)
      .filter((c): c is Condition => c !== null);
    if (nested.length > 0) {
      return { anyOf: nested };
    }
  }

  return null;
}

/**
 * Parse scoring config from YAML
 */
function parseScoring(raw: unknown): ScoringConfig {
  if (!raw || typeof raw !== 'object') {
    return { type: 'binary' };
  }

  const obj = raw as Record<string, unknown>;

  // Agent scoring
  if (obj.type === 'agent' && typeof obj.agentId === 'string') {
    return {
      type: 'agent',
      agentId: obj.agentId,
    };
  }

  // Regex scoring
  if (obj.type === 'regex' && typeof obj.pattern === 'string') {
    return {
      type: 'regex',
      pattern: obj.pattern,
      perMatch: typeof obj.perMatch === 'number' ? obj.perMatch : -5,
    };
  }

  return { type: 'binary' };
}

/**
 * Load all verifications from YAML files
 */
export function loadVerifications(): Verification[] {
  const verificationsDir = join(__dirname, '../../verifications');

  let files: string[];
  try {
    files = readdirSync(verificationsDir).filter(f => f.endsWith('.yaml'));
  } catch {
    return [];
  }

  const verifications: Verification[] = [];

  for (const file of files) {
    try {
      const content = readFileSync(join(verificationsDir, file), 'utf-8');
      const parsed = parseYaml(content) as Record<string, RawVerification>;

      for (const [id, raw] of Object.entries(parsed)) {
        const conditions = (raw.conditions ?? [])
          .map(parseCondition)
          .filter((c): c is Condition => c !== null);

        verifications.push({
          id,
          name: raw.name,
          description: raw.description ?? '',
          category: (raw.category as Verification['category']) ?? 'quality',
          command: raw.command,
          conditions,
          scoring: parseScoring(raw.scoring),
          weight: raw.weight ?? 100,
          target: raw.target ?? 100,
          onError: raw.onError,
        });
      }
    } catch {
      // Skip invalid files
    }
  }

  return verifications;
}
