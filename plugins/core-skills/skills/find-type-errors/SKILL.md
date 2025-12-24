# Find Type Errors

Identify and categorize TypeScript type errors in the project.

## Usage

Use this skill when you need to:
- Find all TypeScript errors
- Understand the nature of type issues
- Prioritize type fixes

## Instructions

1. Run TypeScript compiler: `npx tsc --noEmit`
2. Parse the error output to extract:
   - File path and line number
   - Error code (e.g., TS2345, TS7006)
   - Error message
   - Category (missing types, incorrect types, strict mode issues)
3. Group errors by file and category
4. Prioritize errors that block compilation over style issues
5. Return structured list with fix suggestions
