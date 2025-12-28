import type { CustomCommand, CommandResult, PolishConfig } from './types.js';
/**
 * Built-in command library for TypeScript projects
 */
export declare const BUILTIN_COMMANDS: Record<string, CustomCommand>;
/**
 * Get all built-in command names
 */
export declare function getBuiltinCommandNames(): string[];
/**
 * Get a built-in command by name
 */
export declare function getBuiltinCommand(name: string): CustomCommand | undefined;
/**
 * Get all commands (built-in + custom from config)
 */
export declare function getAllCommands(config?: PolishConfig): CustomCommand[];
/**
 * Get a command by name (checks custom first, then built-in)
 */
export declare function getCommand(name: string, config?: PolishConfig): CustomCommand | undefined;
/**
 * Get commands grouped by category
 */
export declare function getCommandsByCategory(config?: PolishConfig): Record<string, CustomCommand[]>;
/**
 * Execute a command and return the result
 */
export declare function executeCommand(cmd: CustomCommand): Promise<CommandResult>;
/**
 * Run a command by name
 */
export declare function runCommand(name: string, config?: PolishConfig): Promise<CommandResult | null>;
/**
 * Format command result for display
 */
export declare function formatCommandResult(result: CommandResult): string;
