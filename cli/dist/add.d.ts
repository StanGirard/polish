export interface AddOptions {
    weight?: string;
    target?: string;
    command?: string;
}
/**
 * Add a verification to the existing config
 */
export declare function addCommand(name: string, options?: AddOptions): Promise<void>;
