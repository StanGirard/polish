import { VERIFICATIONS, getVerificationNames } from './verifications.js';
/**
 * List all available verifications
 */
export function listCommand() {
    console.log('Available verifications:\n');
    const maxNameLen = Math.max(...getVerificationNames().map((n) => n.length));
    for (const [name, def] of Object.entries(VERIFICATIONS)) {
        console.log(`  ${name.padEnd(maxNameLen + 2)} ${def.description}`);
    }
    console.log('\nUse "polish bank show <name>" for details.');
    console.log('Use "polish add <name>" to add a verification to your config.');
}
/**
 * Show details about a verification
 */
export function showCommand(name) {
    const def = VERIFICATIONS[name];
    if (!def) {
        console.error(`Unknown verification: ${name}`);
        console.error('\nRun "polish bank list" to see available verifications.');
        process.exit(1);
    }
    console.log(`${name} - ${def.description}\n`);
    console.log(`  Command:  ${def.command}`);
    console.log(`  Weight:   ${def.weight}`);
    console.log(`  Target:   ${def.target}`);
    if (def.details) {
        console.log(`\n  ${def.details}`);
    }
    console.log(`\nAdd with: polish add ${name}`);
}
