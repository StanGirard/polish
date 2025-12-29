import { readFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { parse as parseYaml } from 'yaml';
const __dirname = dirname(fileURLToPath(import.meta.url));
/**
 * Parse a condition from YAML
 */
function parseCondition(raw) {
    if (!raw || typeof raw !== 'object')
        return null;
    const obj = raw;
    if ('fileExists' in obj && typeof obj.fileExists === 'string') {
        return { fileExists: obj.fileExists };
    }
    if ('fileContains' in obj && typeof obj.fileContains === 'object') {
        const fc = obj.fileContains;
        if (typeof fc.path === 'string' && typeof fc.pattern === 'string') {
            return { fileContains: { path: fc.path, pattern: fc.pattern } };
        }
    }
    if ('anyOf' in obj && Array.isArray(obj.anyOf)) {
        const nested = obj.anyOf
            .map(parseCondition)
            .filter((c) => c !== null);
        if (nested.length > 0) {
            return { anyOf: nested };
        }
    }
    return null;
}
/**
 * Parse scoring config from YAML
 */
function parseScoring(raw) {
    if (!raw || typeof raw !== 'object') {
        return { type: 'binary' };
    }
    const obj = raw;
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
export function loadVerifications() {
    const verificationsDir = join(__dirname, '../../verifications');
    let files;
    try {
        files = readdirSync(verificationsDir).filter(f => f.endsWith('.yaml'));
    }
    catch {
        return [];
    }
    const verifications = [];
    for (const file of files) {
        try {
            const content = readFileSync(join(verificationsDir, file), 'utf-8');
            const parsed = parseYaml(content);
            for (const [id, raw] of Object.entries(parsed)) {
                const conditions = (raw.conditions ?? [])
                    .map(parseCondition)
                    .filter((c) => c !== null);
                verifications.push({
                    id,
                    name: raw.name,
                    description: raw.description ?? '',
                    category: raw.category ?? 'quality',
                    command: raw.command,
                    conditions,
                    scoring: parseScoring(raw.scoring),
                    weight: raw.weight ?? 100,
                    target: raw.target ?? 100,
                    onError: raw.onError,
                });
            }
        }
        catch {
            // Skip invalid files
        }
    }
    return verifications;
}
