import { exec as execCallback } from 'child_process';
import { promisify } from 'util';

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
