# Improvement Suggestions
## For Branch: `claude/review-pr-improvements-0AVw5`

These are non-blocking improvements that can be implemented in follow-up PRs.

---

## Priority 1: Fix SSR Build Warnings

### Issue
Next.js build shows `useContext` errors during static page generation.

### Root Cause
Client components are being pre-rendered without proper React context providers.

### Solution

**Option A: Add Error Boundaries**
```tsx
// app/error.tsx (create this file)
'use client'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center">
      <div className="text-center">
        <h2 className="text-2xl text-red-400 mb-4">Something went wrong!</h2>
        <button
          onClick={() => reset()}
          className="px-4 py-2 bg-red-600/30 border border-red-400 rounded"
        >
          Try again
        </button>
      </div>
    </div>
  )
}
```

**Option B: Add Suspense Boundaries**
```tsx
// app/page.tsx
import { Suspense } from 'react'

export default function Home() {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <main className="min-h-screen bg-black text-white p-8 font-mono relative">
        {/* existing content */}
      </main>
    </Suspense>
  )
}
```

**Option C: Disable Static Optimization (last resort)**
```tsx
// app/page.tsx
export const dynamic = 'force-dynamic'
```

---

## Priority 2: Add Timeout Protection

### Issue
Review agents can hang indefinitely if they encounter issues.

### Solution
```typescript
// lib/review.ts

// Add timeout utility
function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  errorMessage: string
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(errorMessage)), timeoutMs)
    )
  ])
}

// Update runReviewGate
export async function* runReviewGate(
  context: ReviewContext,
  config: ReviewGateConfig = {},
  queryOptions?: ResolvedQueryOptions
): AsyncGenerator<PolishEvent, ReviewPhaseResult> {
  const {
    maxIterations = DEFAULT_MAX_ITERATIONS,
    requireAllApproval = true,
    timeoutMs = 600000 // 10 minutes default
  } = config

  // ... existing code ...

  // Run all 3 agents in PARALLEL with timeout
  const agentPromises = REVIEW_AGENTS.map(agentType =>
    withTimeout(
      executeReviewAgent(agentType, context, queryOptions),
      timeoutMs,
      `Review agent ${agentType} timed out after ${timeoutMs}ms`
    ).catch(error => ({
      agentType,
      events: [],
      result: {
        agent: agentType,
        verdict: 'rejected' as ReviewVerdict,
        feedback: error.message,
        concerns: ['Agent timeout'],
        systemError: true
      }
    }))
  )

  const agentResults = await Promise.all(agentPromises)
  // ... rest of function
}
```

---

## Priority 3: Distinguish System Errors from Rejections

### Issue
When a review agent crashes, it returns "rejected" verdict, indistinguishable from legitimate rejections.

### Solution
```typescript
// lib/types.ts - Update ReviewResult interface
export interface ReviewResult {
  agent: ReviewAgentType
  verdict: ReviewVerdict
  feedback: string
  concerns: string[]
  redirectTo?: ReviewRedirectTarget
  score?: number
  systemError?: boolean  // NEW: True if agent crashed vs legitimate rejection
  errorDetails?: string  // NEW: Stack trace or error info
}

// lib/review.ts - Update error handling
} catch (error) {
  return {
    agent: agentType,
    verdict: 'rejected',
    feedback: `Review agent encountered an error`,
    concerns: ['System error during review'],
    redirectTo: 'implement',
    systemError: true,  // Mark as system error
    errorDetails: error instanceof Error ? error.stack : String(error)
  }
}

// app/components/VerdictCard.tsx - Show system errors differently
{result.systemError && (
  <div className="mt-2 p-2 bg-red-900/20 border border-red-500/50 rounded">
    <div className="text-red-400 text-xs uppercase tracking-widest mb-1">
      ⚠ System Error
    </div>
    <div className="text-red-300 text-xs">
      The review agent encountered an error during execution.
      This is not a code quality issue.
    </div>
  </div>
)}
```

---

## Priority 4: Add Integration Tests

### Issue
No integration tests for the full review gate flow.

### Solution
Create `lib/__tests__/review-integration.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { runReviewGate } from '../review'
import type { ReviewContext } from '../review'

describe('Review Gate Integration', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('should approve when all 3 agents approve', async () => {
    const context: ReviewContext = {
      projectPath: '/test/project',
      mission: 'Add feature X',
      changedFiles: ['src/feature.ts'],
      iteration: 1
    }

    const events: any[] = []
    let finalResult: any

    for await (const event of runReviewGate(context)) {
      events.push(event)
      if (event.type === 'review_complete') {
        finalResult = event.data
      }
    }

    expect(finalResult.approved).toBe(true)
    expect(events.filter(e => e.type === 'review_result')).toHaveLength(3)
  })

  it('should redirect to implement when agent rejects', async () => {
    // Mock one agent to reject
    // ... test implementation
  })

  it('should handle max iterations gracefully', async () => {
    // Test that review gate stops after max iterations
    // ... test implementation
  })

  it('should handle parallel execution correctly', async () => {
    // Verify all 3 agents run in parallel (not sequential)
    // ... test implementation
  })

  it('should accumulate feedback across iterations', async () => {
    // Test that feedback from previous iterations is preserved
    // ... test implementation
  })
})
```

---

## Priority 5: Translate French Comments

### Issue
Some comments in `lib/loop.ts` remain in French.

### Solution
Update `lib/loop.ts:627-763`:

```typescript
// Before:
// Si isolation désactivée, exécuter directement

// After:
// If isolation disabled, execute directly

// Before:
// Vérifier les prérequis

// After:
// Check prerequisites

// Before:
// Émettre l'événement retry si c'est une relance

// After:
// Emit retry event if this is a retry

// Before:
// Créer le worktree (nouveau ou depuis une branche existante)

// After:
// Create worktree (new or from existing branch)

// ... etc
```

---

## Priority 6: Add Cost Tracking

### Issue
Running 3 Opus agents in parallel can be expensive. No visibility into costs.

### Solution

**1. Add cost tracking to types:**
```typescript
// lib/types.ts
export interface ReviewPhaseResult {
  approved: boolean
  iterations: number
  reviews: ReviewResult[]
  finalFeedback?: string
  redirectTo?: ReviewRedirectTarget
  totalCost?: number  // NEW: Track API costs
  costBreakdown?: {   // NEW: Per-agent costs
    mission_reviewer: number
    senior_engineer: number
    code_reviewer: number
  }
}
```

**2. Track costs in review.ts:**
```typescript
// lib/review.ts
async function* runReviewAgent(
  agentType: ReviewAgentType,
  context: ReviewContext,
  queryOptions?: ResolvedQueryOptions
): AsyncGenerator<PolishEvent, ReviewResult & { cost: number }> {
  // ... existing code ...

  let totalTokens = 0
  let inputTokens = 0
  let outputTokens = 0

  for await (const message of query({ /* ... */ })) {
    if (message.type === 'usage') {
      inputTokens += message.usage.input_tokens
      outputTokens += message.usage.output_tokens
    }
    // ... existing code
  }

  // Estimate cost (rough approximation for Opus)
  const cost = (inputTokens * 0.000015) + (outputTokens * 0.000075)

  return {
    ...parseReviewResult(fullResponse, agentType),
    cost
  }
}
```

**3. Display costs in UI:**
```tsx
// app/components/ReviewPanel.tsx
{reviews.length > 0 && (
  <div className="mt-4 pt-3 border-t border-gray-800">
    {/* existing stats */}
    {totalCost && (
      <div className="flex items-center gap-2 ml-auto">
        <span className="text-[10px] text-gray-600">COST:</span>
        <span className="text-fuchsia-400 font-mono text-xs">
          ${totalCost.toFixed(2)}
        </span>
      </div>
    )}
  </div>
)}
```

---

## Priority 7: Add Configurable Model Selection

### Issue
All review agents use the default model (likely Opus). For cost optimization, some agents could use Sonnet.

### Solution

**Update presets/base.json:**
```json
{
  "capabilities": {
    "review": {
      "agents": {
        "mission_reviewer": {
          "model": "opus",
          "prompt": "...",
          "tools": ["Read", "Glob", "Grep"]
        },
        "senior_engineer": {
          "model": "opus",
          "prompt": "...",
          "tools": ["Read", "Glob", "Grep"]
        },
        "code_reviewer": {
          "model": "sonnet",  // Use Sonnet for cost optimization
          "prompt": "...",
          "tools": ["Read", "Glob", "Grep", "Bash"]
        }
      }
    }
  }
}
```

**Benefits:**
- `mission_reviewer`: Needs Opus for complex reasoning
- `senior_engineer`: Needs Opus for architectural decisions
- `code_reviewer`: Can use Sonnet for line-by-line review (faster + cheaper)
- Estimated cost reduction: ~30-40%

---

## Priority 8: Add Review Agent Disagreement Analysis

### Issue
When agents disagree, there's no analysis of why or which concerns overlap.

### Solution
```typescript
// lib/review.ts - Add new function
function analyzeAgentDisagreement(reviews: ReviewResult[]): {
  overlappingConcerns: string[]
  uniqueConcerns: Map<ReviewAgentType, string[]>
  consensusLevel: number  // 0-100
} {
  const allConcerns = reviews.flatMap(r => r.concerns)
  const concernCounts = new Map<string, number>()

  allConcerns.forEach(concern => {
    concernCounts.set(concern, (concernCounts.get(concern) || 0) + 1)
  })

  const overlappingConcerns = Array.from(concernCounts.entries())
    .filter(([_, count]) => count > 1)
    .map(([concern]) => concern)

  const uniqueConcerns = new Map<ReviewAgentType, string[]>()
  reviews.forEach(review => {
    const unique = review.concerns.filter(c => !overlappingConcerns.includes(c))
    uniqueConcerns.set(review.agent, unique)
  })

  // Calculate consensus level
  const approvalRate = reviews.filter(r => r.verdict === 'approved').length / reviews.length
  const concernOverlap = overlappingConcerns.length / Math.max(allConcerns.length, 1)
  const consensusLevel = Math.round((approvalRate * 0.7 + concernOverlap * 0.3) * 100)

  return { overlappingConcerns, uniqueConcerns, consensusLevel }
}

// Use in UI to show disagreement insights
```

---

## Priority 9: Add Review History Export

### Issue
Review history is lost when session is deleted. No way to export for analysis.

### Solution
```typescript
// lib/review-export.ts (NEW FILE)
export function exportReviewHistory(
  sessionId: string,
  reviews: ReviewPhaseResult[]
): string {
  const report = {
    sessionId,
    exportDate: new Date().toISOString(),
    reviews: reviews.map(r => ({
      iteration: r.iterations,
      approved: r.approved,
      agents: r.reviews.map(agent => ({
        type: agent.agent,
        verdict: agent.verdict,
        score: agent.score,
        concerns: agent.concerns
      }))
    }))
  }

  return JSON.stringify(report, null, 2)
}

// Add export button in SessionDetail
```

---

## Priority 10: Performance Monitoring

### Issue
No visibility into review gate performance (duration, memory usage).

### Solution
```typescript
// lib/review.ts - Add performance tracking
export async function* runReviewGate(
  context: ReviewContext,
  config: ReviewGateConfig = {},
  queryOptions?: ResolvedQueryOptions
): AsyncGenerator<PolishEvent, ReviewPhaseResult> {
  const startTime = Date.now()
  const startMemory = process.memoryUsage().heapUsed

  // ... existing code ...

  const endTime = Date.now()
  const endMemory = process.memoryUsage().heapUsed

  yield {
    type: 'status',
    data: {
      phase: 'review',
      message: `Review completed in ${Math.round((endTime - startTime) / 1000)}s`,
      duration: endTime - startTime,
      memoryDelta: endMemory - startMemory
    }
  }

  // ... return result
}
```

---

## Implementation Priority

1. **Immediate** (before merge):
   - Fix SSR build warnings

2. **High Priority** (next PR):
   - Add timeout protection
   - Distinguish system errors from rejections
   - Add integration tests

3. **Medium Priority** (within 2 weeks):
   - Translate French comments
   - Add cost tracking
   - Configure model selection per agent

4. **Low Priority** (nice to have):
   - Add disagreement analysis
   - Add review history export
   - Add performance monitoring

---

## Conclusion

These improvements will make the review gate system more robust, maintainable, and cost-efficient. None are blocking for merge, but implementing them will significantly enhance the production experience.
