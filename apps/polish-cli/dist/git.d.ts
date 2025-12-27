export interface GitSnapshot {
    ref: string | null;
    hadChanges: boolean;
}
/**
 * Create a snapshot of current changes (stash)
 */
export declare function gitSnapshot(): Promise<GitSnapshot>;
/**
 * Rollback to a previous snapshot
 */
export declare function gitRollback(snapshot: GitSnapshot): Promise<void>;
/**
 * Commit all current changes
 */
export declare function gitCommit(message: string): Promise<string>;
/**
 * Check if we're in a git repository
 */
export declare function isGitRepo(): Promise<boolean>;
/**
 * Get current branch name
 */
export declare function getCurrentBranch(): Promise<string>;
/**
 * Check if there are uncommitted changes
 */
export declare function hasUncommittedChanges(): Promise<boolean>;
export interface WorktreeInfo {
    path: string;
    baseBranch: string;
    baseCommit: string;
}
/**
 * Generate a unique branch name for polish work
 * Format: polish/YYYY-MM-DD-abc123
 */
export declare function generatePolishBranchName(): string;
/**
 * Create a temporary worktree for isolated polish work
 * Uses detached HEAD so we don't create a branch until completion
 */
export declare function createWorktree(baseBranch: string): Promise<WorktreeInfo>;
/**
 * Remove a worktree and clean up
 */
export declare function removeWorktree(worktreePath: string): Promise<void>;
/**
 * Create a branch from the worktree's current HEAD
 * This is called at the end of polish loop to save the work
 */
export declare function createBranchFromWorktree(worktreePath: string, branchName: string): Promise<string>;
