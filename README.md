# Polish

Automated code quality improvement tool. Runs an LLM in a loop to iteratively fix lint errors, type issues, add tests, and more.

## How it works

1. Clone your repository
2. Calculate initial quality score (lint errors, type errors, test coverage, etc.)
3. Loop:
   - Select the strategy targeting the worst metric
   - Ask LLM to make one atomic fix
   - Apply changes and run tests
   - If improved: commit. If not: rollback
   - Repeat until time runs out or max score reached
4. Push changes and create a PR

## Setup

1. Install dependencies:
```bash
pnpm install
```

2. Copy `.env.example` to `.env` and fill in your keys:
```bash
cp .env.example .env
```

Required environment variables:
- `OPENROUTER_API_KEY` - Your OpenRouter API key
- `GITHUB_TOKEN` - GitHub personal access token with repo access
- `TRIGGER_SECRET_KEY` - Trigger.dev secret key

3. Run the development server:
```bash
pnpm dev
```

4. In a separate terminal, run Trigger.dev:
```bash
pnpm trigger:dev
```

## Usage

1. Open http://localhost:3000
2. Enter a GitHub repository URL
3. Select duration (30min - 2h)
4. Click "Start Polishing"
5. Monitor progress on the job page
6. Review and merge the generated PR

## Presets

Currently supports:
- **Next.js** - ESLint errors, TypeScript errors, test coverage, bundle size

Coming soon:
- Python (Ruff, mypy, pytest)
- Rust (Clippy, cargo test)

## Architecture

- `/app` - Next.js App Router pages and API routes
- `/lib` - Core logic modules
  - `types.ts` - TypeScript interfaces
  - `executor.ts` - Safe shell command execution
  - `detector.ts` - Stack detection and preset loading
  - `scorer.ts` - Quality metric calculation
  - `llm.ts` - OpenRouter/GLM integration
  - `git.ts` - Git operations
  - `loop.ts` - Main orchestration loop
- `/trigger` - Trigger.dev background jobs
- `/presets` - Stack-specific configurations

## License

MIT
