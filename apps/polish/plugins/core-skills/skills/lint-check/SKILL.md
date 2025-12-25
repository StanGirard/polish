# Lint Check

Run ESLint analysis and categorize issues.

## Usage

Use this skill when you need to:
- Find lint errors and warnings
- Understand code quality issues
- Prioritize lint fixes

## Instructions

1. Run ESLint: `npx eslint . --format json`
2. Parse the JSON output to extract:
   - File path and line number
   - Rule ID (e.g., no-unused-vars, @typescript-eslint/no-explicit-any)
   - Severity (error vs warning)
   - Message
3. Group issues by rule and severity
4. Prioritize errors over warnings
5. Identify auto-fixable issues with `--fix`
6. Return structured report with fix suggestions
