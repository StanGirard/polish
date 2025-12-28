import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { glob } from 'glob';
import type { Condition } from './types.js';

/**
 * Evaluate a single condition against a directory
 */
export async function evaluateCondition(
  condition: Condition,
  cwd: string
): Promise<boolean> {
  // File exists (supports globs)
  if ('fileExists' in condition) {
    const pattern = condition.fileExists;

    // Check for directory (trailing /)
    if (pattern.endsWith('/')) {
      return existsSync(join(cwd, pattern.slice(0, -1)));
    }

    // Use glob for patterns with wildcards
    if (pattern.includes('*')) {
      const matches = await glob(pattern, { cwd });
      return matches.length > 0;
    }

    return existsSync(join(cwd, pattern));
  }

  // File contains pattern
  if ('fileContains' in condition) {
    const { path, pattern } = condition.fileContains;
    const fullPath = join(cwd, path);

    if (!existsSync(fullPath)) return false;

    try {
      const content = readFileSync(fullPath, 'utf-8');
      return content.includes(pattern);
    } catch {
      return false;
    }
  }

  // OR logic
  if ('anyOf' in condition) {
    for (const sub of condition.anyOf) {
      if (await evaluateCondition(sub, cwd)) return true;
    }
    return false;
  }

  return false;
}

/**
 * Evaluate all conditions (AND logic)
 */
export async function evaluateConditions(
  conditions: Condition[],
  cwd: string
): Promise<boolean> {
  for (const condition of conditions) {
    if (!(await evaluateCondition(condition, cwd))) {
      return false;
    }
  }
  return true;
}
