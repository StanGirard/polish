# Polish

**An agentic coding system that runs small or large LLMs for hours to guarantee long-term code quality.**

## What Makes Polish Different

Polish is not just another AI coding assistant. It's a **persistent quality automation system** that solves the fundamental problem of AI-generated code: **it's fast, but not done**.

```
┌──────────────────────────────────────────────────────────────────┐
│  Traditional AI Coding          Polish                           │
├──────────────────────────────────────────────────────────────────┤
│  Generate code in 30 sec        Generate in 5 min                │
│  YOU fix for 2-3 hours          AI polishes for 2 hours          │
│  Ship when "good enough"        Ship when metrics say 95%+       │
│  Black box magic                24 atomic commits you can review │
│  No quality metrics             Score: 34 → 89 (proven)          │
│  One-shot, hope it works        1000 iterations, tested & rolled │
└──────────────────────────────────────────────────────────────────┘
```

### Core Capabilities

1. **Persistent Iteration** - Runs for hours, not seconds
2. **Objective Quality** - Measures lint, types, tests, coverage (not vibes)
3. **Atomic Commits** - Each fix is isolated, tested, committable
4. **Cost Efficient** - Uses small models for iteration ($0.13 vs $2.50)
5. **Fail-Safe** - Tests prevent regressions, auto-rollback on failure
6. **Transparent** - See exactly what changed and why

Polish is what you get when you optimize for **time to production** instead of **time to first draft**.

## The Problem: Black Box Vibe Coding

Current AI coding tools give you a black box:
1. **One-shot generation** → You get code, but no iteration
2. **No quality guarantee** → 80% works, 20% is broken
3. **Human cleanup required** → You spend hours fixing types, tests, lint
4. **No persistence** → Each session starts from scratch
5. **No measurable progress** → You can't track quality improvements

The result? You're debugging AI-generated code instead of shipping features.

### What's wrong with the 80% solution?

LLMs can generate code that "works" in 30 seconds. But production code needs:
- **Zero type errors** (not "mostly typed")
- **Comprehensive tests** (not "TODO: add tests")
- **Zero lint errors** (not "we'll fix it later")
- **Edge case handling** (not "works for happy path")
- **Consistent style** (not "mixed conventions")

You can't ship 80%. Polish gets you to 95%+.

## The Solution: Persistent Quality Loops

Polish solves the black box problem with **transparent, measurable iteration**:

### Phase 1 — IMPLEMENT (Fast)
- LLM reads your codebase to understand patterns
- Generates initial implementation (rough, functional)
- Creates atomic commits with clear messages
- **Time: Minutes to 1 hour depending on complexity**

### Phase 2 — POLISH (Persistent)
An autonomous loop that runs for hours:

```
┌─────────────────────────────────────┐
│  1. Measure Quality                 │  ← Objective metrics (not vibes)
│     → lint: 23 errors               │
│     → types: 15 errors              │
│     → coverage: 45%                 │
│     → tests: 3 failing              │
├─────────────────────────────────────┤
│  2. Pick Worst Metric               │  ← Data-driven priority
│     → Focus: typeErrors (worst)     │
├─────────────────────────────────────┤
│  3. Generate Atomic Fix             │  ← Small, focused changes
│     → LLM fixes ONE type error      │
├─────────────────────────────────────┤
│  4. Validate Change                 │  ← No blind commits
│     → Run tests                     │
│     → Recalculate score             │
├─────────────────────────────────────┤
│  5. Commit or Rollback              │  ← Keep only improvements
│     → If score improved: commit     │
│     → If tests fail: rollback       │
│     → Log failure to avoid repeats  │
└─────────────────────────────────────┘
         ↓
     Repeat until: score >= 90 OR timeout OR plateau
```

**Key insight:** Small models (Haiku, DeepSeek-R1) work great for atomic fixes when you can run them for hours. Big models (Opus, Sonnet) shine on initial implementation.

### Why This Works

1. **Measurable progress** - Score goes from 34 → 67 → 89 (not vibes)
2. **Atomic changes** - Each fix is isolated, tested, committable
3. **Transparent history** - 24 commits showing exactly what improved
4. **Model flexibility** - Use cheap models for polish loops (1000+ fixes for $5)
5. **Fail-safe** - Tests prevent regressions, rollback prevents breakage
6. **Learns from failures** - Failed approaches are logged and avoided

Polish doesn't ask "does this feel right?" It asks "did the score improve?"

## Mission: Time × Quality Trade-off

Polish exists because **AI coding has been optimizing the wrong thing**.

### The Industry Optimizes: Speed to First Draft
- "Generate a React component in 10 seconds!"
- "Write an API endpoint in 30 seconds!"
- "Refactor this file instantly!"

**Result:** Fast, broken code that takes 2 hours to fix.

### Polish Optimizes: Time to Production Quality
- Generate in 5 minutes (slower initial)
- Polish for 2 hours (automated)
- Ship with 95% test coverage (done)

**Result:** Slower first draft, but you're done when it's done.

### The Math That Matters

```
Traditional AI Coding:
├─ Generate: 30 seconds
├─ Manual fixes: 2 hours        ← YOU do this
├─ Add tests: 1 hour            ← YOU do this
├─ Fix edge cases: 30 minutes   ← YOU do this
└─ Total developer time: 3.5 hours

Polish:
├─ Generate: 5 minutes
├─ Automated polish: 2 hours    ← AUTONOMOUS
├─ Your review: 10 minutes      ← YOU just review
└─ Total developer time: 15 minutes
```

**The insight:** Developer time is expensive. Compute time is cheap. Let computers iterate for hours so humans don't have to.

### Why "Long Running" Matters

Small models become powerful when you give them time:
- **DeepSeek-R1** at $0.001/fix × 1000 fixes = $1, production-ready
- **Claude Sonnet** at $0.05/fix × 20 fixes = $1, needs more work
- **Cursor/Copilot** at $0/one-shot = free, but you fix it manually

Polish makes cheap models viable through **iteration at scale**.

## Philosophy: No More Black Boxes

Current AI tools are black boxes:
```
[Your prompt] → [??? Magic ???] → [Code that might work]
                    ↑
               What happened?
               Why this approach?
               What's wrong?
```

Polish is transparent:
```
[Your mission] → [Implement phase: 24 commits]
                  ↓
              [Score: 34/100]
                  ↓
              [Polish: fix-types → +3 pts → commit]
              [Polish: add-tests → +8 pts → commit]
              [Polish: fix-lint → +2 pts → commit]
              [Polish: fix-types → tests failed → rollback]
                  ↓
              [Score: 89/100]
                  ↓
              [24 atomic commits, each tested and scored]
```

You see:
- What changed in each commit
- Why it changed (metric improvement)
- What failed and was rolled back
- Exact score progression: 34 → 67 → 89

No magic. Just metrics.

## How It Works

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  INPUT                                                      │
│  "Add OAuth authentication with GitHub and Google"         │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  PHASE 1: IMPLEMENT                                         │
│                                                             │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐     │
│  │  Analyze    │ -> │  Generate   │ -> │   Write     │     │
│  │  Project    │    │   Code      │    │   Files     │     │
│  └─────────────┘    └─────────────┘    └─────────────┘     │
│                                               │             │
│                                               v             │
│                                    Commit "feat: X (WIP)"   │
│                                    Initial score: 34/100    │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  PHASE 2: POLISH (loop)                                     │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │                                                       │  │
│  │   ┌─────────┐   ┌─────────┐   ┌─────────┐           │  │
│  │   │  Score  │ → │  Find   │ → │  LLM    │           │  │
│  │   │         │   │  Worst  │   │  Fix    │           │  │
│  │   └─────────┘   └─────────┘   └─────────┘           │  │
│  │        ↑                            │                │  │
│  │        │                            v                │  │
│  │        │    ┌─────────┐   ┌─────────────────┐       │  │
│  │        └────│ Commit  │ ← │  Run Tests      │       │  │
│  │             │   or    │   │  + Recalculate  │       │  │
│  │             │Rollback │   │     Score       │       │  │
│  │             └─────────┘   └─────────────────┘       │  │
│  │                                                      │  │
│  │   Repeat until: timeout OR max score OR plateau      │  │
│  │                                                      │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  OUTPUT                                                     │
│                                                             │
│  Score: 34 → 91 (+57 pts)                                  │
│  24 atomic commits                                          │
│  Clean, tested, typed code                                  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## Usage

### Web UI

Start the app and open your browser:

```
┌─────────────────────────────────────────────────────────────┐
│  POLISH                                                     │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  📂 Project: /Users/dev/my-project                         │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Add OAuth authentication with GitHub and Google.    │   │
│  │ Include:                                             │   │
│  │ - Login/logout                                       │   │
│  │ - Persistent sessions                                │   │
│  │ - Route protection middleware                        │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  Duration: [30m] [1h] [•2h]                                │
│                                                             │
│  [ 🚀 Start Polish ]                                        │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

Real-time progress:

```
┌─────────────────────────────────────────────────────────────┐
│  POLISH — Running                     Elapsed: 4m 32s       │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ████████████████████░░░░░░░░░░░░░░░░░░░░░░░░  67/100      │
│  Score: 34 → 67 (+33 pts)                                  │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Metrics                                              │   │
│  │                                                      │   │
│  │ lintErrors    ████████████████████ 100%  ✓          │   │
│  │ typeErrors    ████████████░░░░░░░░  58%  ← fixing   │   │
│  │ coverage      ██████████░░░░░░░░░░  45%             │   │
│  │ testsPassing  █████████████████░░░  78%             │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ History                                              │   │
│  │                                                      │   │
│  │ #12  fix-types   +3 pts   Add return type to...     │   │
│  │ #11  add-tests   +8 pts   Add test for parse...     │   │
│  │ #10  fix-types   +5 pts   Fix Optional type...      │   │
│  │ #9   fix-lint    +2 pts   Remove unused import      │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  [ ⏹ Stop ]                                                 │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### CLI

```bash
# With a mission
npx polish "Add a GET /api/users/:id endpoint with validation"

# Just improve existing code (skip phase 1)
npx polish --polish-only

# With max duration
npx polish "Add OAuth" --duration 1h

# With a detailed mission file
npx polish --mission mission.md
```

## Core Concepts

### Metrics

A metric is an objective quality measurement:

```
┌────────────────────────────────────────────────────────────┐
│  METRIC                                                    │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  name           Identifier (e.g., "lintErrors")           │
│  weight         Relative importance (total = 100)          │
│  command        Shell command that returns a number        │
│  higherIsBetter Direction of optimization                  │
│  target         Goal to reach                              │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

Each metric is normalized to 0-100. The global score is the weighted average.

### Strategies

A strategy is an approach to improve a specific metric:

```
┌────────────────────────────────────────────────────────────┐
│  STRATEGY                                                  │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  name     "fix-types"                                      │
│  focus    "typeErrors"      ← which metric to improve     │
│  prompt   "Fix ONE TypeScript error. Add missing types."  │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

Polish automatically picks the strategy targeting the worst metric.

### Presets

A preset is a ready-to-use configuration for a given stack:

```
┌──────────────────────────────────────────────────────────────────┐
│                                                                  │
│  nextjs.json          python.json           rust.json           │
│  ├── ESLint           ├── Ruff              ├── Clippy          │
│  ├── TypeScript       ├── mypy              ├── cargo test      │
│  ├── Jest             ├── pytest            └── doc coverage    │
│  └── Bundle size      └── radon                                 │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

Polish auto-detects your stack and loads the right preset.

### Failure History

When a fix fails (tests break, no improvement), Polish:

1. Rollbacks the change
2. Logs the failure with context
3. Passes this history to the LLM to avoid repeating

```
┌────────────────────────────────────────────────────────────┐
│  FAILURE HISTORY (passed to LLM)                           │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  - fix-types on src/auth.ts:45 → tests_failed             │
│  - add-tests on src/api.ts → no_improvement               │
│  - fix-lint on src/utils.ts → error                       │
│                                                            │
│  "Avoid these approaches, try something else"              │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

### Stop Conditions

Polish stops when:

```
┌────────────────────────────────────────────────────────────┐
│  STOP CONDITIONS                                           │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  1. TIMEOUT         Max duration reached (default: 2h)     │
│                                                            │
│  2. MAX SCORE       Score >= 90 (configurable)            │
│                                                            │
│  3. PLATEAU         X iterations without improvement       │
│                     across all strategies                  │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

## Architecture

```
polish/
│
├── src/
│   └── core/                    # Shared logic
│       ├── types.ts             # TypeScript types
│       ├── context.ts           # Project analysis
│       ├── implement.ts         # Phase 1: generate code
│       ├── scorer.ts            # Calculate metrics
│       ├── loop.ts              # Phase 2: polish loop
│       ├── llm.ts               # OpenRouter / Claude Sonnet 4.5 client
│       ├── git.ts               # Commit / rollback
│       ├── executor.ts          # Shell execution
│       └── parser.ts            # Parse LLM responses
│
├── app/                         # Next.js UI
│   ├── page.tsx                 # Mission form
│   ├── polish/[id]/page.tsx     # Real-time progress
│   └── api/
│       ├── polish/route.ts      # POST: start job
│       └── polish/[id]/
│           └── stream/route.ts  # SSE: progress events
│
├── cli/                         # CLI wrapper
│   ├── index.ts                 # Entry point
│   └── logger.ts                # Terminal output
│
└── presets/
    ├── base.json                # Shared rules
    ├── nextjs.json
    ├── python.json
    └── rust.json
```

## Data Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│  UI (browser)                          CLI (terminal)           │
│       │                                      │                  │
│       └──────────────┬───────────────────────┘                  │
│                      │                                          │
│                      v                                          │
│               ┌─────────────┐                                   │
│               │    CORE     │                                   │
│               └─────────────┘                                   │
│                      │                                          │
│      ┌───────────────┼───────────────┐                          │
│      │               │               │                          │
│      v               v               v                          │
│ ┌─────────┐   ┌─────────────┐   ┌─────────┐                    │
│ │ Context │   │ Implement   │   │  Loop   │                    │
│ │ Analyze │   │ (Phase 1)   │   │(Phase 2)│                    │
│ └─────────┘   └─────────────┘   └─────────┘                    │
│                      │               │                          │
│                      v               v                          │
│               ┌─────────────────────────┐                       │
│               │          LLM            │                       │
│               │   (Claude Sonnet 4.5 via OpenRouter)                      │
│               └─────────────────────────┘                       │
│                      │                                          │
│                      v                                          │
│               ┌─────────────┐                                   │
│               │     Git     │                                   │
│               │   Commits   │                                   │
│               └─────────────┘                                   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## The Polish Loop (Phase 2)

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│                         START                                   │
│                           │                                     │
│                           v                                     │
│                   ┌───────────────┐                             │
│                   │  Calculate    │                             │
│                   │    Score      │                             │
│                   └───────────────┘                             │
│                           │                                     │
│                           v                                     │
│              ┌────────────────────────┐                         │
│              │  score >= 90?          │──── yes ───→ DONE       │
│              │  timeout?              │                         │
│              │  plateau?              │                         │
│              └────────────────────────┘                         │
│                           │ no                                  │
│                           v                                     │
│                   ┌───────────────┐                             │
│                   │ Find worst    │                             │
│                   │   metric      │                             │
│                   └───────────────┘                             │
│                           │                                     │
│                           v                                     │
│                   ┌───────────────┐                             │
│                   │ Pick strategy │                             │
│                   │  for metric   │                             │
│                   └───────────────┘                             │
│                           │                                     │
│                           v                                     │
│                   ┌───────────────┐                             │
│                   │  Build prompt │                             │
│                   │  with context │                             │
│                   │  + failures   │                             │
│                   └───────────────┘                             │
│                           │                                     │
│                           v                                     │
│                   ┌───────────────┐                             │
│                   │   Call LLM    │                             │
│                   │   (Claude Sonnet 4.5)   │                             │
│                   └───────────────┘                             │
│                           │                                     │
│                           v                                     │
│                   ┌───────────────┐                             │
│                   │ Parse & apply │                             │
│                   │    changes    │                             │
│                   └───────────────┘                             │
│                           │                                     │
│                           v                                     │
│                   ┌───────────────┐                             │
│                   │  Run tests    │                             │
│                   └───────────────┘                             │
│                           │                                     │
│                           v                                     │
│                   ┌───────────────┐                             │
│                   │  Recalculate  │                             │
│                   │    score      │                             │
│                   └───────────────┘                             │
│                           │                                     │
│                           v                                     │
│              ┌────────────────────────┐                         │
│              │  improved >= 0.5 pts?  │                         │
│              └────────────────────────┘                         │
│                    │             │                              │
│                   yes            no                             │
│                    │             │                              │
│                    v             v                              │
│             ┌──────────┐  ┌───────────┐                         │
│             │  Commit  │  │ Rollback  │                         │
│             │          │  │ + log     │                         │
│             │          │  │ failure   │                         │
│             └──────────┘  └───────────┘                         │
│                    │             │                              │
│                    └──────┬──────┘                              │
│                           │                                     │
│                           └──────────→ (back to Calculate)      │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## LLM Communication

### Phase 1: Implement

```
┌─────────────────────────────────────────────────────────────────┐
│  PROMPT TO LLM                                                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Mission:        "Add OAuth with GitHub"                       │
│                                                                 │
│  Project context:                                               │
│  ├── Stack: Next.js 14, TypeScript                             │
│  ├── Structure: app/, lib/, components/                        │
│  └── Conventions: camelCase, PascalCase components             │
│                                                                 │
│  Relevant files:                                                │
│  ├── lib/auth/index.ts                                         │
│  ├── app/api/auth/route.ts                                     │
│  └── middleware.ts                                              │
│                                                                 │
│  Instructions:                                                  │
│  → Generate all necessary files                                 │
│  → Modify existing files if needed                              │
│  → List dependencies to add                                     │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│  LLM RESPONSE                                                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Dependencies: next-auth @auth/github                           │
│                                                                 │
│  Files:                                                         │
│  ├── lib/auth/config.ts         (new)                          │
│  ├── lib/auth/providers.ts      (new)                          │
│  ├── app/api/auth/[...]/route.ts (new)                         │
│  └── middleware.ts              (modified)                      │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Phase 2: Fix

```
┌─────────────────────────────────────────────────────────────────┐
│  PROMPT TO LLM                                                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Rules:                                                         │
│  ├── Never break existing tests                                 │
│  ├── One atomic change only                                     │
│  └── Prefer removing code over adding                           │
│                                                                 │
│  Current score: 67/100                                          │
│                                                                 │
│  Metrics:                                                       │
│  ├── lintErrors:   100/100 ✓                                   │
│  ├── typeErrors:    58/100  ← 15 errors in lib/auth/           │
│  ├── coverage:      45/100                                      │
│  └── testsPassing:  78/100                                      │
│                                                                 │
│  Recent failures (don't repeat):                                │
│  ├── fix-types on lib/auth.ts:45 → tests_failed                │
│  └── add-tests on lib/api.ts → no_improvement                  │
│                                                                 │
│  Your task:                                                     │
│  → Fix ONE TypeScript error. Add missing types.                 │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│  LLM RESPONSE                                                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Explanation: Add return type to getUser function               │
│                                                                 │
│  File: lib/auth/users.ts                                        │
│  (complete file content with fix applied)                       │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Scoring

```
┌─────────────────────────────────────────────────────────────────┐
│  HOW SCORING WORKS                                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  For each metric:                                               │
│                                                                 │
│  1. Execute command         eslint . --format json | jq '...'  │
│                                      │                          │
│                                      v                          │
│  2. Get raw value                   23 (errors)                 │
│                                      │                          │
│                                      v                          │
│  3. Normalize to 0-100                                          │
│                                                                 │
│     If higherIsBetter: score = (value / target) × 100          │
│     If lowerIsBetter:  score = max(0, 100 - value × factor)    │
│                                      │                          │
│                                      v                          │
│  4. Apply weight                    0 × 25% = 0 pts             │
│                                                                 │
│  ───────────────────────────────────────────────────────────── │
│                                                                 │
│  Global score = Σ (metric score × weight) / Σ weights          │
│                                                                 │
│  Example:                                                       │
│  ├── lintErrors:   0 errors   → 100/100 × 25% = 25 pts        │
│  ├── typeErrors:   15 errors  →  25/100 × 25% = 6.25 pts      │
│  ├── coverage:     45%        →  56/100 × 25% = 14 pts        │
│  └── testsPassing: 78%        →  78/100 × 25% = 19.5 pts      │
│                                                                 │
│  Total: 64.75 / 100                                            │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Configuration

### Environment Variables

```bash
# Required: API access
OPENROUTER_API_KEY=sk-or-...              # OpenRouter API key

# Optional: Model selection
ANTHROPIC_MODEL=anthropic/claude-sonnet-4 # Default model (Phase 1 & 2)

# Optional: Per-phase model optimization
IMPLEMENT_MODEL=anthropic/claude-opus-4   # Big model for Phase 1
POLISH_MODEL=deepseek/deepseek-r1         # Small model for Phase 2

# Optional: Debugging
POLISH_VERBOSE=true                       # Detailed logs
TOOL_LOG_LEVEL=verbose                    # Tool call logging
```

### Model Strategy Examples

**Maximum Quality (Expensive)**
```bash
IMPLEMENT_MODEL=anthropic/claude-opus-4
POLISH_MODEL=anthropic/claude-sonnet-4
# Cost: ~$2.50 per 2h session
```

**Best Value (Recommended)**
```bash
IMPLEMENT_MODEL=anthropic/claude-sonnet-4
POLISH_MODEL=deepseek/deepseek-r1
# Cost: ~$0.13 per 2h session
```

**Maximum Scale (Cheap)**
```bash
IMPLEMENT_MODEL=deepseek/deepseek-r1
POLISH_MODEL=deepseek/deepseek-r1
# Cost: ~$0.05 per 2h session
# Note: May need more iterations, but works at scale
```

**Testing/Development**
```bash
IMPLEMENT_MODEL=anthropic/claude-haiku-4
POLISH_MODEL=anthropic/claude-haiku-4
# Cost: ~$0.02 per session
# Good for preset testing and development
```

### Preset Structure

```
┌─────────────────────────────────────────────────────────────────┐
│  PRESET (e.g., nextjs.json)                                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  extends: "base"               ← Inherit from base.json        │
│                                                                 │
│  detect:                       ← How to detect this stack      │
│  ├── files: [next.config.js]                                   │
│  └── package.json: { dependencies: ["next"] }                  │
│                                                                 │
│  setup: "npm install"          ← Command to install deps       │
│                                                                 │
│  metrics:                      ← Quality measurements          │
│  ├── lintErrors (weight: 25)                                   │
│  ├── typeErrors (weight: 25)                                   │
│  ├── coverage (weight: 25)                                     │
│  └── testsPassing (weight: 25)                                 │
│                                                                 │
│  strategies:                   ← Approaches to fix metrics     │
│  ├── fix-lint → lintErrors                                     │
│  ├── fix-types → typeErrors                                    │
│  ├── add-tests → coverage                                      │
│  └── fix-tests → testsPassing                                  │
│                                                                 │
│  thresholds:                   ← Stop conditions               │
│  ├── minImprovement: 0.5                                       │
│  ├── maxStalled: 5                                             │
│  └── maxScore: 90                                              │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Cost Estimate

Polish is designed to be **economical** by using the right model for each phase:

```
┌─────────────────────────────────────────────────────────────────┐
│  STRATEGY: BIG MODEL FOR IMPLEMENT, SMALL FOR POLISH           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Phase 1 - Implementation (Claude Sonnet 4.5):                 │
│  ├── Task: Understand codebase, design solution                │
│  ├── Why big model: Needs reasoning & context                  │
│  ├── Tokens: ~30K input, ~15K output                           │
│  └── Cost: ~$0.03                                              │
│                                                                 │
│  Phase 2 - Polish Loop (DeepSeek-R1 / Haiku):                  │
│  ├── Task: Fix ONE lint/type error at a time                   │
│  ├── Why small model: Atomic fixes, less reasoning             │
│  ├── Iterations: ~100 fixes over 2 hours                       │
│  ├── Tokens: ~5K input, ~2K output per fix                     │
│  └── Cost: ~$0.10 for 100 iterations                           │
│                                                                 │
│  ───────────────────────────────────────────────────────────── │
│                                                                 │
│  TOTAL: ~$0.13 for a 2-hour session                            │
│                                                                 │
│  Compare to all-Sonnet: $2.50+ for same quality                │
│  Savings: 95% cheaper by using right model at right time       │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘

Model Recommendations:
┌────────────────────────────────────────────────────────────────┐
│  Phase 1 (Implement)        │  Phase 2 (Polish)               │
├────────────────────────────────────────────────────────────────┤
│  • Claude Sonnet 4.5         │  • DeepSeek-R1 (best value)    │
│  • Claude Opus 4.5           │  • Haiku 3.5                   │
│  • GPT-4 Turbo               │  • Llama 3.3 70B               │
│  • DeepSeek-R1 (for scale)   │  • Gemini Flash                │
└────────────────────────────────────────────────────────────────┘
```

**Key insight:** Atomic fixes don't need genius-level reasoning. A $0.001/fix model running 1000 times beats a $0.10/fix model running 10 times.

## Limitations

1. **Runs locally** — Terminal must stay open (for now)
2. **System dependencies** — Requires git, node/python depending on project
3. **No native dependencies** — Only npm/pip packages, not system libraries
4. **Limited context** — LLM sees relevant files, not the entire project
5. **Vague missions** — More specific = better results

## Example Missions

**Simple feature**
```
Add a POST /api/subscribe endpoint that saves an email to the database
```

**Complex feature**
```
Implement a Redis cache system for API requests with:
- Configurable TTL per route
- Automatic invalidation on mutations
- Hit/miss metrics
```

**Refactoring**
```
Migrate state management from Redux to Zustand
```

**Bug fix**
```
Fix the bug where users are logged out after 5 minutes of inactivity
```

**Pure improvement** (skips Phase 1)
```
npx polish --polish-only
```

## Tech Stack

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│  Framework          Next.js 14+ (App Router)                   │
│  Language           TypeScript                                  │
│  Styling            Tailwind CSS                                │
│  LLM                Claude Sonnet 4.5 via OpenRouter                      │
│  Real-time          Server-Sent Events (SSE)                    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Roadmap

- [ ] Background execution with Trigger.dev
- [ ] GitHub Action integration
- [ ] More stack presets (Go, Rust, PHP)
- [ ] "Creative mode" to unblock plateaus
- [ ] Session history dashboard
- [ ] GitHub App (no token needed)
