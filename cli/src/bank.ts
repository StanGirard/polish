import { getAllVerifications, getVerification } from './verifications/index.js';

/**
 * List all available verifications
 */
export function listCommand(): void {
  const verifications = getAllVerifications();

  console.log('Available verifications:\n');

  // Group by category
  const byCategory: Record<string, typeof verifications> = {};
  for (const v of verifications) {
    const cat = v.category;
    if (!byCategory[cat]) {
      byCategory[cat] = [];
    }
    byCategory[cat].push(v);
  }

  const categoryOrder = ['tests', 'types', 'lint', 'build', 'security', 'quality'];

  for (const cat of categoryOrder) {
    const list = byCategory[cat];
    if (!list || list.length === 0) continue;

    console.log(`${cat.toUpperCase()}`);
    for (const v of list) {
      console.log(`  ${v.id.padEnd(18)} ${v.description}`);
    }
    console.log('');
  }

  console.log('Use "polish bank show <name>" for details.');
  console.log('Use "polish add <name>" to add a verification to your config.');
}

/**
 * Show details about a verification
 */
export function showCommand(name: string): void {
  const v = getVerification(name);

  if (!v) {
    console.error(`Unknown verification: ${name}`);
    console.error('\nRun "polish bank list" to see available verifications.');
    process.exit(1);
  }

  console.log(`${v.id} - ${v.name}\n`);
  console.log(`  Description: ${v.description}`);
  console.log(`  Category:    ${v.category}`);
  console.log(`  Command:     ${v.command}`);
  console.log(`  Weight:      ${v.weight}`);
  console.log(`  Target:      ${v.target}`);

  if (v.onError) {
    console.log(`\n  On Error: ${v.onError}`);
  }

  console.log(`\nAdd with: polish add ${v.id}`);
}
