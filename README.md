# Polish

A Claude Code hook for production-quality vibe coding.

## The Problem

Vibe coding is fast. Maintaining it is hell.

AI-generated code looks great on day one. After a month? Bugs, spaghetti, no tests. Each fix breaks something else.

## The Solution

Polish is a hook that keeps Claude working until your code hits 95%+ quality. The loop:

1. **Measure** - Run lint, types, tests, coverage
2. **Identify** - Find the worst metric
3. **Fix** - Claude makes one atomic change
4. **Validate** - Check if it improved
5. **Repeat** - Until score >= 95%

## Get Started

```bash
npm install -g polish-cli
polish init
polish hook install
```

That's it. Now when Claude tries to stop, Polish checks your metrics first.

## Adding Checks

```bash
polish add typescript
polish add lint
polish add build
```

See all available checks: `polish bank list`

## License

MIT
