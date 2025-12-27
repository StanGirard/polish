# Polish

Code quality enforcement for Claude Code. Polish blocks Claude from stopping until your metrics pass.

## Installation

```bash
# Install the hook in your project
polish hook install
```

This adds a stop hook to `.claude/settings.local.json`. When Claude tries to stop, Polish runs your metrics and blocks if they fail.

## Configuration

Create `polish.config.json` in your project root:

```json
{
  "metrics": [
    { "name": "tests", "command": "bun test", "weight": 100, "target": 100 }
  ],
  "target": 95
}
```

See `examples/polish.config.json` for a complete example.

## Metrics

Each metric has:
- `name` - Identifier (some have special parsing: tests, typescript, lint, coverage, duplication)
- `command` - Shell command to run
- `weight` - Relative importance (used for weighted average)
- `target` - Score threshold (0-100)

### Common metrics

| Metric | Command | Description |
|--------|---------|-------------|
| tests | `bun test` | Run tests (any failure = 0) |
| build | `bun run build` | Check compilation |
| typescript | `tsc --noEmit` | Type checking |
| lint | `eslint src` | Code style |
| duplication | `npx jscpd src --threshold 5` | Detect copy-paste |
| coverage | `bun test --coverage` | Test coverage % |

## How it works

1. Claude tries to stop working
2. Polish hook runs all configured metrics
3. Calculates weighted score from results
4. If score < target: blocks Claude with feedback on worst metric
5. If score >= target: allows Claude to stop
6. Plateau detection prevents infinite loops (5 stalls = stop)

## Commands

```bash
polish hook install    # Add hook to Claude Code
polish hook uninstall  # Remove hook
polish hook status     # Check if installed
polish status          # Show current metrics/state
polish reset           # Clear session state
```

## Config locations

Polish looks for config in order:
1. `polish.config.json`
2. `.polish.json`
3. `.polish/polish.config.json`
