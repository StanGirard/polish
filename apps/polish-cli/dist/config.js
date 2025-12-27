import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
// Default metrics when no config file exists
const DEFAULT_METRICS = [
    {
        name: 'tests',
        command: 'bun test',
        weight: 100,
        target: 100,
        higherIsBetter: true,
    },
];
const DEFAULT_CONFIG = {
    metrics: DEFAULT_METRICS,
    target: 95,
    maxIterations: 50,
};
export function loadConfig(configPath) {
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
function parseConfig(path) {
    try {
        const content = readFileSync(path, 'utf-8');
        const parsed = JSON.parse(content);
        // Merge with defaults
        return {
            metrics: parsed.metrics ?? DEFAULT_METRICS,
            target: parsed.target ?? DEFAULT_CONFIG.target,
            maxIterations: parsed.maxIterations ?? DEFAULT_CONFIG.maxIterations,
        };
    }
    catch (error) {
        console.error(`Error parsing config file: ${path}`, error);
        return DEFAULT_CONFIG;
    }
}
