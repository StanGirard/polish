# Analyze Test Coverage

Analyze test coverage and identify files with low coverage.

## Usage

Use this skill when you need to:
- Find files with low test coverage
- Prioritize which files need tests
- Understand the overall testing status

## Instructions

1. Run the coverage command: `bun test --coverage` or `bun test:coverage`
2. Parse the coverage report to identify files below threshold
3. Focus on `lib/` and `app/` directories
4. Exclude configuration files and generated code
5. Return a ranked list of files needing tests, with:
   - File path
   - Current coverage percentage
   - Number of uncovered lines
   - Suggested test file location
