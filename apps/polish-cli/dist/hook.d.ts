#!/usr/bin/env node
/**
 * Polish Stop Hook for Claude Code
 *
 * This script is called by Claude Code when the agent wants to stop.
 * It runs metrics, checks if target is reached, and decides whether
 * Claude should continue or stop.
 *
 * Input (stdin): JSON with session info including stop_hook_active
 * Output (stdout): JSON with { decision: "block" | "approve", reason: string }
 *
 * Exit codes:
 * - 0: Success (check stdout for decision)
 * - 2: Blocking error
 */
export {};
