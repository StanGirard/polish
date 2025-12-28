export interface InitOptions {
    force?: boolean;
    dryRun?: boolean;
    yes?: boolean;
}
/**
 * Initialize Polish configuration for the current project
 */
export declare function initCommand(options?: InitOptions): Promise<void>;
