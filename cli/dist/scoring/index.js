// Strategy registry
const strategies = new Map();
// Register a strategy
export function registerStrategy(strategy) {
    strategies.set(strategy.type, strategy);
}
// Parse score using the appropriate strategy
export function parseScoreWithStrategy(output, exitCode, config) {
    const strategy = strategies.get(config.type);
    if (!strategy) {
        // Fallback to binary
        return exitCode === 0 ? 100 : 0;
    }
    return strategy.parse(output, exitCode, config);
}
// Binary strategy: exit code 0 = 100, otherwise 0
export const binaryStrategy = {
    type: 'binary',
    parse(_output, exitCode) {
        return exitCode === 0 ? 100 : 0;
    },
};
// Percentage strategy: extract percentage from output
export const percentageStrategy = {
    type: 'percentage',
    parse(output, exitCode, config) {
        const pattern = config.pattern || /([\d.]+)\s*%/;
        const regex = typeof pattern === 'string' ? new RegExp(pattern) : pattern;
        const match = output.match(regex);
        if (!match) {
            return exitCode === 0 ? 100 : 0;
        }
        return Math.round(parseFloat(match[1]));
    },
};
// Count-inverse strategy: 100 - (count / maxCount * 100)
export const countInverseStrategy = {
    type: 'count-inverse',
    parse(output, exitCode, config) {
        if (exitCode === 0 && !config.pattern) {
            return 100;
        }
        const pattern = config.pattern || /(\d+)/;
        const regex = typeof pattern === 'string' ? new RegExp(pattern) : pattern;
        const match = output.match(regex);
        if (!match) {
            return exitCode === 0 ? 100 : 50;
        }
        const count = parseInt(match[1], 10);
        const maxCount = config.maxCount || 20;
        const penalty = (count / maxCount) * 100;
        return Math.max(0, Math.round(100 - penalty));
    },
};
// Custom strategy: use formula (limited implementation)
export const customStrategy = {
    type: 'custom',
    parse(output, exitCode, config) {
        if (!config.pattern) {
            return exitCode === 0 ? 100 : 0;
        }
        const regex = new RegExp(config.pattern);
        const match = output.match(regex);
        if (!match) {
            return exitCode === 0 ? 100 : 0;
        }
        // Simple formula support: just extract the first captured group as score
        // For more complex formulas, this could be expanded
        if (match[1]) {
            const value = parseFloat(match[1]);
            if (!isNaN(value)) {
                return Math.max(0, Math.min(100, Math.round(value)));
            }
        }
        return exitCode === 0 ? 100 : 0;
    },
};
// Register built-in strategies
registerStrategy(binaryStrategy);
registerStrategy(percentageStrategy);
registerStrategy(countInverseStrategy);
registerStrategy(customStrategy);
