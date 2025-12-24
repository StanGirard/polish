#!/usr/bin/env node
/**
 * CLI script to check code style metrics
 * Usage: node scripts/check-code-style.ts [path]
 */

import { calculateCodeStyleScore } from '../lib/code-style-analyzer'

const projectPath = process.argv[2] || process.cwd()

calculateCodeStyleScore(projectPath)
  .then(score => {
    console.log(score.toFixed(1))
    process.exit(0)
  })
  .catch(err => {
    console.error('Error analyzing code style:', err)
    process.exit(1)
  })
