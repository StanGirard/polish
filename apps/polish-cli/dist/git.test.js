import { describe, test, expect } from 'bun:test';
import { isGitRepo, getCurrentBranch, hasUncommittedChanges } from './git.js';
describe('isGitRepo', () => {
    test('returns true in a git repository', async () => {
        // This test file is in a git repo
        const result = await isGitRepo();
        expect(result).toBe(true);
    });
});
describe('getCurrentBranch', () => {
    test('returns a branch name', async () => {
        const branch = await getCurrentBranch();
        expect(typeof branch).toBe('string');
        expect(branch.length).toBeGreaterThan(0);
    });
});
describe('hasUncommittedChanges', () => {
    test('returns a boolean', async () => {
        const result = await hasUncommittedChanges();
        expect(typeof result).toBe('boolean');
    });
});
// Note: gitSnapshot, gitRollback, and gitCommit tests are omitted
// because they modify git state and would be disruptive to run
// in a normal test environment. These would be better tested
// in an isolated git repo fixture.
