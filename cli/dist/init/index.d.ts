export interface InitOptions {
    force?: boolean;
    dryRun?: boolean;
    yes?: boolean;
}
/**
 * Initialize Polish configuration for the current project
 */
export declare function initCommand(options?: InitOptions): Promise<void>;
/**
 * Re-export for use in other modules
 */
export { detectStack, getStackSummary } from './detectors.js';
