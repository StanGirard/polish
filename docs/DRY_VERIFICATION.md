# DRY Verification Agent

## Overview

The DRY (Don't Repeat Yourself) verification agent is a code quality metric that detects and helps reduce code duplication in your project. Unlike other AI-based tools, this verification **does not use an LLM** for detection - it uses static analysis tools to find duplicated code patterns.

## How It Works

### Detection (No LLM)

The detection phase uses **jscpd** (JavaScript Copy/Paste Detector), a static analysis tool that:
- Scans TypeScript, JavaScript, TSX, and JSX files
- Identifies code blocks with similar structure and tokens
- Reports duplications without any AI inference
- Provides line-by-line comparison of duplicated code

**Configuration:**
- Minimum lines to consider: 5
- Minimum tokens to consider: 50
- Ignores: JSON files, Markdown, node_modules, build directories

### Scoring

The duplication metric contributes to the overall code quality score:
- **Weight:** 25% (significant impact)
- **Target:** 0 duplications
- **Direction:** Lower is better
- **Command:** `npx jscpd app/ lib/ --min-lines 5 --min-tokens 50`

### Refactoring Strategy

When duplications are detected, the polish agent:
1. Runs `jscpd` to identify specific duplications
2. Analyzes the duplicated code blocks
3. Extracts common code into reusable functions/utilities
4. Replaces duplicated code with calls to the new function
5. Verifies tests still pass
6. Commits the improvement if successful

## Example

**Before (5 duplications):**
```typescript
// lib/agent.ts
const toolHook: HookCallback = async (input) => {
  if (input.hook_event_name !== 'PreToolUse' && input.hook_event_name !== 'PostToolUse') {
    return {}
  }
  // ... hook logic ...
}

// lib/implement.ts
const toolHook: HookCallback = async (input) => {
  if (input.hook_event_name !== 'PreToolUse' && input.hook_event_name !== 'PostToolUse') {
    return {}
  }
  // ... same hook logic ...
}
```

**After (0 duplications):**
```typescript
// lib/hooks.ts
export function createToolHook(options: ToolHookOptions): HookCallback {
  return async (input) => {
    if (input.hook_event_name !== 'PreToolUse' && input.hook_event_name !== 'PostToolUse') {
      return {}
    }
    // ... shared hook logic ...
  }
}

// lib/agent.ts
import { createToolHook } from './hooks'
const toolHook = createToolHook({ /* options */ })

// lib/implement.ts
import { createToolHook } from './hooks'
const toolHook = createToolHook({ /* options */ })
```

## Benefits

1. **No AI Hallucinations:** Uses deterministic static analysis
2. **Fast:** No LLM calls for detection phase
3. **Reliable:** Consistent results across runs
4. **Cost-effective:** Only uses LLM for refactoring suggestions
5. **Maintainable:** Reduces code duplication systematically

## Configuration

Edit `.jscpd.json` to customize detection:
```json
{
  "minLines": 5,        // Minimum lines for duplication
  "minTokens": 50,      // Minimum tokens for duplication
  "ignore": [           // Files/folders to ignore
    "**/*.json",
    "**/node_modules/**"
  ]
}
```

Edit `presets/nextjs.json` to adjust weight:
```json
{
  "name": "codeDuplication",
  "weight": 25,         // Adjust importance (0-100)
  "target": 0           // Target duplications
}
```

## Testing

Run the test script to verify the metric:
```bash
node test-duplication-metric.js
```

Or manually check duplications:
```bash
npx jscpd app/ lib/ --min-lines 5 --min-tokens 50
```

## Integration

The DRY verification is automatically integrated into the polish loop:
- Runs on every iteration
- Contributes 25% to the overall quality score
- Triggers refactoring when it's the worst metric
- Works alongside lint, type, and warning checks

## Future Improvements

Potential enhancements:
- Support for more languages (Python, Go, Rust)
- Configurable duplication thresholds per file type
- Visualization of duplication clusters
- IDE integration for real-time feedback
