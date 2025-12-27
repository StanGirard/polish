import { exec as execCallback } from 'child_process';
import { promisify } from 'util';
import { randomBytes } from 'crypto';
import * as path from 'path';
import * as fs from 'fs/promises';

const exec = promisify(execCallback);

export interface GitSnapshot {
  ref: string | null;
  hadChanges: boolean;
}

/**
 * Create a snapshot of current changes (stash)
 */
export async function gitSnapshot(): Promise<GitSnapshot> {
  try {
    // Check if there are any changes
    const { stdout: status } = await exec('git status --porcelain');
    const hadChanges = status.trim().length > 0;

    if (!hadChanges) {
      return { ref: null, hadChanges: false };
    }

    // Create a stash
    const { stdout } = await exec('git stash create');
    const ref = stdout.trim() || null;

    return { ref, hadChanges };
  } catch (error) {
    console.error('Error creating git snapshot:', error);
    return { ref: null, hadChanges: false };
  }
}

/**
 * Rollback to a previous snapshot
 */
export async function gitRollback(snapshot: GitSnapshot): Promise<void> {
  try {
    // Discard all current changes
    await exec('git checkout -- .');
    await exec('git clean -fd');

    // Restore stashed changes if any
    if (snapshot.ref) {
      await exec(`git stash apply ${snapshot.ref}`);
    }
  } catch (error) {
    console.error('Error rolling back:', error);
    throw error;
  }
}

/**
 * Commit all current changes
 */
export async function gitCommit(message: string): Promise<string> {
  try {
    await exec('git add -A');
    const { stdout } = await exec(`git commit -m "${message.replace(/"/g, '\\"')}"`);

    // Get the commit hash
    const { stdout: hash } = await exec('git rev-parse --short HEAD');
    return hash.trim();
  } catch (error) {
    console.error('Error committing:', error);
    throw error;
  }
}

/**
 * Check if we're in a git repository
 */
export async function isGitRepo(): Promise<boolean> {
  try {
    await exec('git rev-parse --git-dir');
    return true;
  } catch {
    return false;
  }
}

/**
 * Get current branch name
 */
export async function getCurrentBranch(): Promise<string> {
  const { stdout } = await exec('git branch --show-current');
  return stdout.trim();
}

/**
 * Check if there are uncommitted changes
 */
export async function hasUncommittedChanges(): Promise<boolean> {
  const { stdout } = await exec('git status --porcelain');
  return stdout.trim().length > 0;
}

// ============================================================
// Worktree Management
// ============================================================

export interface WorktreeInfo {
  path: string;          // Absolute path to worktree directory
  baseBranch: string;    // Branch worktree was created from
  baseCommit: string;    // Commit hash at creation
}

/**
 * Generate a unique branch name for polish work
 * Format: polish/YYYY-MM-DD-abc123
 */
export function generatePolishBranchName(): string {
  const date = new Date().toISOString().split('T')[0];
  const id = randomBytes(3).toString('hex');
  return `polish/${date}-${id}`;
}

/**
 * Create a temporary worktree for isolated polish work
 * Uses detached HEAD so we don't create a branch until completion
 */
export async function createWorktree(baseBranch: string): Promise<WorktreeInfo> {
  // Get the current commit hash
  const { stdout: commitHash } = await exec('git rev-parse HEAD');
  const baseCommit = commitHash.trim();

  // Worktree path is inside .polish directory (already gitignored)
  const worktreePath = path.resolve(process.cwd(), '.polish', 'worktree');

  // Remove existing worktree if it exists (from crashed session)
  try {
    await exec(`git worktree remove --force "${worktreePath}"`);
  } catch {
    // Ignore errors - worktree may not exist
  }

  // Also remove the directory if it somehow still exists
  try {
    await fs.rm(worktreePath, { recursive: true, force: true });
  } catch {
    // Ignore
  }

  // Create the worktree with detached HEAD
  await exec(`git worktree add --detach "${worktreePath}" HEAD`);

  return {
    path: worktreePath,
    baseBranch,
    baseCommit,
  };
}

/**
 * Remove a worktree and clean up
 */
export async function removeWorktree(worktreePath: string): Promise<void> {
  try {
    await exec(`git worktree remove --force "${worktreePath}"`);
  } catch {
    // If git worktree remove fails, try manual cleanup
    try {
      await fs.rm(worktreePath, { recursive: true, force: true });
      await exec('git worktree prune');
    } catch {
      // Best effort cleanup
    }
  }
}

/**
 * Create a branch from the worktree's current HEAD
 * This is called at the end of polish loop to save the work
 */
export async function createBranchFromWorktree(
  worktreePath: string,
  branchName: string
): Promise<string> {
  // Get the HEAD commit from the worktree
  const { stdout: commitHash } = await exec('git rev-parse HEAD', { cwd: worktreePath });
  const commit = commitHash.trim();

  // Create the branch pointing to that commit (from main repo)
  await exec(`git branch "${branchName}" ${commit}`);

  return commit;
}
