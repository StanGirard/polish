import { describe, test, expect } from 'bun:test';
import {
  isGitRepo,
  getCurrentBranch,
  hasUncommittedChanges,
  generatePolishBranchName,
} from './git.js';

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

describe('generatePolishBranchName', () => {
  test('generates a branch name with correct format', () => {
    const branchName = generatePolishBranchName();

    // Should start with 'polish/'
    expect(branchName.startsWith('polish/')).toBe(true);

    // Should have date format YYYY-MM-DD
    const parts = branchName.split('/')[1].split('-');
    expect(parts.length).toBe(4); // year, month, day, id

    // Year should be 4 digits
    expect(parts[0]).toMatch(/^\d{4}$/);
    // Month should be 2 digits
    expect(parts[1]).toMatch(/^\d{2}$/);
    // Day should be 2 digits
    expect(parts[2]).toMatch(/^\d{2}$/);
    // ID should be 6 hex characters
    expect(parts[3]).toMatch(/^[a-f0-9]{6}$/);
  });

  test('generates unique branch names', () => {
    const name1 = generatePolishBranchName();
    const name2 = generatePolishBranchName();

    // The random ID part should make them different
    expect(name1).not.toBe(name2);
  });
});

// Note: createWorktree, removeWorktree, and createBranchFromWorktree tests
// are omitted because they modify git state significantly (creating worktrees
// and branches). These would be better tested in an isolated git repo fixture.
