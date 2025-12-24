# Tool Logging Examples

Exemples concrets d'utilisation du système de logging des tool calls.

## Example 1: Normal Logging (Default)

```bash
# Run with default logging level
npm run dev
```

**Console Output:**
```
▸ GLOB
✓ GLOB
  ⏱️  45ms

▸ READ
✓ READ
  ⏱️  12ms

▸ TASK [Explore]
✓ TASK [Explore]
  ⏱️  3.42s

▸ EDIT
✓ EDIT
  ⏱️  89ms
```

## Example 2: Verbose Logging

```bash
# Enable verbose logging to see sizes and more details
TOOL_LOG_LEVEL=verbose npm run dev
```

**Console Output:**
```
▸ GLOB
  📥 Input: 45B
✓ GLOB
  ⏱️  45ms
  📤 Output: 2.3KB

▸ READ
  📥 Input: 78B
✓ READ
  ⏱️  12ms
  📤 Output: 5.6KB

▸ TASK [Explore]
  📥 Input: 234B
✓ TASK [Explore]
  ⏱️  3.42s
  📤 Output: 8.9KB

📊 Tool Call Statistics
==================================================
Total calls: 42
Sub-agent calls: 3
Errors: 0
Total duration: 28.45s
Average duration: 677ms

Calls by tool:
  Read: 18
  Glob: 6
  Task: 3
  Grep: 8
  Edit: 5
  Write: 2
```

## Example 3: Debug Logging

```bash
# Enable debug logging to see full input/output
TOOL_LOG_LEVEL=debug npm run dev
```

**Console Output:**
```
▸ GLOB
  📥 Input: 45B
  📋 Input:
    {
      "pattern": "**/*.ts",
      "path": "/project"
    }
✓ GLOB
  ⏱️  45ms
  📤 Output: 2.3KB
  📄 Output:
    /project/lib/agent.ts
    /project/lib/implement.ts
    /project/lib/planner.ts
    /project/lib/tool-logger.ts
    ...

▸ READ
  📥 Input: 78B
  📋 Input:
    {
      "file_path": "/project/lib/agent.ts"
    }
✓ READ
  ⏱️  12ms
  📤 Output: 5.6KB
  📄 Output:
    import {
      query,
      type HookCallback,
    ...
```

## Example 4: Minimal Logging (Production)

```bash
# Minimal logging for production - no console spam
TOOL_LOG_LEVEL=minimal npm start
```

**Console Output:**
```
[No tool call logs shown]
[Statistics are collected but not printed unless explicitly requested]
```

## Example 5: Programmatic Usage

```typescript
import { createToolLogger, type ToolCallTracker } from './lib/tool-logger'

// Create a logger instance
const { tracker, hook } = createToolLogger('verbose')

// Use in agent hooks
const agent = query({
  prompt: 'Your prompt here',
  options: {
    hooks: {
      PreToolUse: [{ hooks: [hook] }],
      PostToolUse: [{ hooks: [hook] }]
    }
  }
})

// Later, get statistics
const stats = tracker.getStats()
console.log(`Total calls: ${stats.totalCalls}`)
console.log(`Errors: ${stats.errors}`)
console.log(`Average duration: ${stats.averageDuration}ms`)

// Or print a formatted summary
console.log(tracker.getSummary())
```

## Example 6: Custom Filtering

```typescript
import { createToolLogger } from './lib/tool-logger'

const { tracker, hook } = createToolLogger('verbose')

// ... run your agent ...

// Get statistics
const stats = tracker.getStats()

// Find slowest tool
const slowestTool = Object.entries(stats.callsByTool)
  .map(([tool, count]) => ({ tool, count }))
  .sort((a, b) => b.count - a.count)[0]

console.log(`Most used tool: ${slowestTool.tool} (${slowestTool.count} calls)`)

// Check for errors
if (stats.errors > 0) {
  console.warn(`⚠️  ${stats.errors} tool calls failed`)
}

// Sub-agent usage
if (stats.subAgentCalls > 0) {
  console.log(`🤖 Used ${stats.subAgentCalls} sub-agents`)
}
```

## Example 7: Real-time Dashboard (UI)

Dans l'interface web, les statistiques sont affichées en temps réel dans le composant EventLog:

```tsx
import { EventLog } from '@/app/components/EventLog'

function SessionView() {
  const [events, setEvents] = useState([])

  return (
    <div>
      {/* Shows stats header with expandable panel */}
      <EventLog
        events={events}
        showStats={true}  // Enable statistics display
      />
    </div>
  )
}
```

**UI Display:**
```
┌─────────────────────────────────────────────────┐
│ 🔧 42 calls  🤖 3 agents  ⚡ Read    [▶ Stats]  │
└─────────────────────────────────────────────────┘

[Click to expand statistics panel]

┌─────────────────────────────────────────────────┐
│ 📊 Tool Call Statistics                         │
│                                                  │
│ Total calls:     42                              │
│ Sub-agents:      3                               │
│                                                  │
│ ─────────────────────────────────────────────   │
│                                                  │
│ By tool:                                         │
│   Read:  18                                      │
│   Grep:  8                                       │
│   Glob:  6                                       │
│   Edit:  5                                       │
│   Task:  3                                       │
│   Write: 2                                       │
└─────────────────────────────────────────────────┘
```

## Example 8: CI/CD Integration

```yaml
# .github/workflows/polish.yml
name: Polish Code

on: [push]

jobs:
  polish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2

      - name: Run Polish with verbose logging
        env:
          TOOL_LOG_LEVEL: verbose
        run: npm run polish

      - name: Extract statistics
        run: |
          # Parse tool call statistics from logs
          grep "📊 Tool Call Statistics" -A 20 polish.log
```

## Example 9: Error Debugging

When debugging a specific tool call failure:

```bash
# Enable debug mode to see full input/output
TOOL_LOG_LEVEL=debug npm run dev 2>&1 | tee debug.log

# Filter for errors
grep -A 10 "❌ Error:" debug.log

# Check specific tool
grep -A 5 "▸ READ" debug.log
```

## Example 10: Performance Profiling

```typescript
import { createToolLogger } from './lib/tool-logger'

const { tracker } = createToolLogger('verbose')

// Run your agent...

// Analyze performance
const stats = tracker.getStats()

console.log('Performance Analysis:')
console.log(`  Total duration: ${(stats.totalDuration / 1000).toFixed(2)}s`)
console.log(`  Average per call: ${stats.averageDuration.toFixed(0)}ms`)
console.log(`  Total calls: ${stats.totalCalls}`)

// Calculate throughput
const throughput = stats.totalCalls / (stats.totalDuration / 1000)
console.log(`  Throughput: ${throughput.toFixed(2)} calls/second`)

// Identify bottlenecks
if (stats.averageDuration > 1000) {
  console.warn('⚠️  Average tool call duration is high (>1s)')
  console.warn('    Consider optimizing or using smaller models')
}
```

## Tips

1. **Start with Normal**: Use the default `normal` level for development
2. **Verbose for Debugging**: Switch to `verbose` when investigating issues
3. **Debug for Deep Dives**: Use `debug` only when you need to see exact inputs/outputs
4. **Minimal for Production**: Always use `minimal` in production environments
5. **Watch Statistics**: The stats summary gives you a quick health check of agent performance

## Common Patterns

### Pattern 1: High Error Rate
```
📊 Tool Call Statistics
Total calls: 100
Errors: 25
```
**Action**: Enable debug logging to see what's failing and why.

### Pattern 2: Slow Performance
```
Average duration: 3.4s
```
**Action**: Check which tools are slowest, consider using faster sub-agents or caching.

### Pattern 3: Too Many Calls
```
Total calls: 500
  Read: 450
```
**Action**: Agent might be reading files multiple times. Consider improving context management.

### Pattern 4: No Sub-Agent Usage
```
Sub-agents: 0
```
**Action**: If using planning mode, ensure sub-agents are properly configured.
