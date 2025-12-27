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
