# Tool Call Logging

Polish now includes an enhanced tool call logging system that provides detailed visibility into agent operations.

## Features

- **Structured logging** with contextual information
- **Performance tracking** for each tool call
- **Statistics collection** across all tool calls
- **Configurable verbosity levels** (minimal, normal, verbose, debug)
- **Sub-agent tracking** with visual indicators
- **Color-coded output** for better readability

## Configuration

Set the `TOOL_LOG_LEVEL` environment variable to control logging verbosity:

```bash
# Minimal - Only statistics (no individual tool calls logged)
export TOOL_LOG_LEVEL=minimal

# Normal - Basic tool call info (default)
export TOOL_LOG_LEVEL=normal

# Verbose - Includes timing, sizes, and detailed metadata
export TOOL_LOG_LEVEL=verbose

# Debug - Full input/output data for each tool call
export TOOL_LOG_LEVEL=debug
```

## Log Levels Explained

### Minimal
- No individual tool call logs
- Statistics summary only (if phase ends)
- Best for production or CI/CD

### Normal (Default)
- Shows tool name and phase (PreToolUse/PostToolUse)
- Sub-agent type if applicable
- Execution time for completed tools
- Error messages if any

Example output:
```
▸ READ
✓ READ
  ⏱️  234ms

▸ TASK [Explore]
✓ TASK [Explore]
  ⏱️  5.67s
```

### Verbose
- Everything from Normal
- Input/output sizes
- Detailed timing information
- Statistics summary at the end

Example output:
```
▸ EDIT
  📥 Input: 1.2KB
✓ EDIT
  ⏱️  156ms
  📤 Output: 45B
```

### Debug
- Everything from Verbose
- Full input data (truncated to 500 chars)
- Full output data (truncated to 1000 chars)
- Maximum visibility for troubleshooting

Example output:
```
▸ GLOB
  📥 Input: 234B
  📋 Input:
    {
      "pattern": "**/*.ts",
      "path": "/project"
    }
✓ GLOB
  ⏱️  89ms
  📤 Output: 3.4KB
  📄 Output:
    /project/lib/agent.ts
    /project/lib/implement.ts
    ...
```

## Statistics Summary

At the end of each phase (when using verbose or debug mode), a statistics summary is displayed:

```
📊 Tool Call Statistics
==================================================
Total calls: 47
Sub-agent calls: 3
Errors: 0
Total duration: 45.23s
Average duration: 962ms

Calls by tool:
  Read: 15
  Task: 3
  Glob: 8
  Grep: 12
  Edit: 7
  Write: 2
```

## Tool Call Metadata

Each tool call tracks:
- **Tool name** (Read, Write, Edit, Bash, Glob, Grep, Task, etc.)
- **Phase** (PreToolUse = about to execute, PostToolUse = completed)
- **Timestamp** (when the call occurred)
- **Duration** (execution time in milliseconds)
- **Input/Output sizes** (in bytes, KB, or MB)
- **Success/failure status**
- **Error messages** (if applicable)
- **Sub-agent type** (for Task tool calls: Explore, Plan, etc.)

## Sub-Agent Tracking

Sub-agent calls (via the Task tool) are specially highlighted:

```
▸ TASK [Explore]  ● (animated)
  Quick exploration of project

✓ TASK [Explore]
  ⏱️  8.42s
  → Found 23 TypeScript files...
```

Sub-agent types include:
- **Explore** - Codebase exploration
- **Plan** - Architecture planning
- **research** - Deep analysis
- **code-analysis** - Code review
- **security-review** - Security audit
- **test-analysis** - Test coverage

## Usage in Code

The tool logger is automatically integrated into all agent phases:
- Implementation phase (`runImplementPhase`)
- Polish loop (`runSingleFix`)
- Planning phase (`runPlanningPhase`)
- Legacy polish agent (`runPolishAgent`)

You can also use it directly:

```typescript
import { createToolLogger, logToolCall } from './lib/tool-logger'

// Create a logger with custom level
const { tracker, hook } = createToolLogger('verbose')

// Use in SDK hooks
hooks: {
  PreToolUse: [{ hooks: [hook] }],
  PostToolUse: [{ hooks: [hook] }]
}

// Get statistics at any time
const stats = tracker.getStats()
console.log(`Total calls: ${stats.totalCalls}`)

// Get a formatted summary
console.log(tracker.getSummary())

// Log a single tool call manually
logToolCall('Read', 'PreToolUse', { file_path: '/foo/bar.ts' })
```

## Performance Impact

The logging system is designed to have minimal performance impact:
- **Minimal mode**: ~0ms overhead per tool call
- **Normal mode**: ~1-2ms overhead per tool call
- **Verbose mode**: ~2-5ms overhead per tool call
- **Debug mode**: ~5-10ms overhead per tool call (due to JSON serialization)

The overhead is negligible compared to actual tool execution time (typically 50ms-5s per tool).

## Troubleshooting

### Tool calls not showing up
- Ensure `TOOL_LOG_LEVEL` is not set to `minimal`
- Check that hooks are properly configured in the SDK query options

### Statistics not displayed
- Statistics are only shown at the end of a phase
- Requires `verbose` or `debug` log level
- May not display if phase errors out early

### Output is too verbose
- Set `TOOL_LOG_LEVEL=normal` for balanced output
- Use `minimal` in production environments
- Consider filtering console output with grep/awk if needed

## Examples

### Basic development workflow
```bash
# Run with normal logging (default)
npm run dev

# Or explicitly set
TOOL_LOG_LEVEL=normal npm run dev
```

### Debugging a specific issue
```bash
# Enable debug logging to see full input/output
TOOL_LOG_LEVEL=debug npm run dev
```

### Production deployment
```bash
# Minimize logging overhead
TOOL_LOG_LEVEL=minimal npm start
```

### CI/CD pipeline
```bash
# Get statistics without verbose output
TOOL_LOG_LEVEL=minimal npm run polish
# Statistics will still be collected and available in the session summary
```

## Future Enhancements

Planned improvements:
- [ ] Configurable output formats (JSON, CSV)
- [ ] Persistent logging to file
- [ ] Real-time dashboard for tool call monitoring
- [ ] Integration with OpenTelemetry for distributed tracing
- [ ] Tool call replay for debugging
- [ ] Performance profiling and bottleneck detection
