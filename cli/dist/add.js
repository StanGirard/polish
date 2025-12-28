import { loadConfig, saveConfig, getConfigPath } from './config.js';
import { VERIFICATIONS, verificationToMetric, getVerificationNames } from './verifications.js';
/**
 * Add a verification to the existing config
 */
export async function addCommand(name, options = {}) {
    const cwd = process.cwd();
    // Check if config exists
    const configPath = getConfigPath(cwd);
    if (!configPath) {
        console.error('No polish.config.json found.');
        console.error('Run "polish init" first to create a configuration.');
        process.exit(1);
    }
    // Check if verification exists
    const def = VERIFICATIONS[name];
    if (!def) {
        console.error(`Unknown verification: ${name}`);
        console.error('\nAvailable verifications:');
        for (const n of getVerificationNames()) {
            console.error(`  - ${n}`);
        }
        console.error('\nRun "polish bank list" for details.');
        process.exit(1);
    }
    // Load existing config
    const config = loadConfig();
    // Check if already exists
    const existing = config.metrics.find((m) => m.name === name);
    if (existing) {
        console.error(`Verification "${name}" already exists in config.`);
        console.error(`  Command: ${existing.command}`);
        console.error(`  Weight: ${existing.weight}, Target: ${existing.target}`);
        process.exit(1);
    }
    // Build metric with overrides
    const metric = verificationToMetric(def, {
        command: options.command,
        weight: options.weight ? parseInt(options.weight, 10) : undefined,
        target: options.target ? parseInt(options.target, 10) : undefined,
    });
    // Add to config
    config.metrics.push(metric);
    // Save config
    await saveConfig(config, configPath);
    console.log(`Added "${name}" to ${configPath}`);
    console.log(`  Command: ${metric.command}`);
    console.log(`  Weight: ${metric.weight}, Target: ${metric.target}`);
}
