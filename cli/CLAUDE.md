# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build and Test Commands

```bash
bun run build          # Compile TypeScript and set executable permissions
bun test               # Run all tests
bun test src/file.test.ts  # Run single test file
```

## Architecture Overview

Polish is a Claude Code stop hook that enforces code quality through automated metrics checking.

When Claude tries to stop working:
1. `hook.ts` runs configured metrics (tests, lint, duplication, etc.)
2. Calculates weighted score from all metrics
3. If score < target: blocks Claude and provides feedback on worst metric
4. If score >= target or plateau detected: allows stop

## Key Files

- `src/hook.ts` - Claude Code stop hook entry point (runs as `polish-hook` command)
- `src/index.ts` - CLI entry point for hook management commands
- `src/metrics.ts` - Runs metric commands, parses output (tests, typescript, lint, coverage, duplication)
- `src/config.ts` - Loads `polish.config.json` or `.polish/polish.config.json`
- `src/state.ts` - Persists session state to `.polish/state.json`
- `src/plateau.ts` - Detects when score stops improving (5 consecutive stalls)
- `src/types.ts` - Type definitions

## Configuration

Config file locations (searched in order): `polish.config.json`, `.polish.json`, `.polish/polish.config.json`

```json
{
  "metrics": [
    { "name": "tests", "command": "bun test", "weight": 100, "target": 100 },
    { "name": "duplication", "command": "npx jscpd src --threshold 5", "weight": 100, "target": 95 }
  ],
  "target": 95
}
```

Metric names with special parsing: `tests`, `typescript`/`tsc`, `lint`/`eslint`, `coverage`, `duplication`/`jscpd`

## CLI Commands

```bash
polish hook install    # Install stop hook to .claude/settings.local.json
polish hook uninstall  # Remove the hook
polish hook status     # Check installation status
polish status          # Show current metrics/state
polish reset           # Clear state
```

## Score Calculation

- Each metric runs its command and parses output to get 0-100 score
- Tests: Any failure = 0 (strict mode)
- Final score = weighted average of all metrics
- Score history tracked in `.polish/state.json`
- Plateau = 5 consecutive iterations without 0.5+ improvement
