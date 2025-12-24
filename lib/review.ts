// Review Phase - Strict code review by multiple expert agents
// This phase runs after testing and can send work back to implement or testing phases

import { query, type QueryResult } from '@anthropic-ai/claude-code'
import { v4 as uuidv4 } from 'uuid'
import {
  type PolishEvent,
  type ReviewConfig,
  type ReviewerType,
  type ReviewVerdict,
  type ReviewerResult,
  type ReviewPhaseResult,
  type ReviewIssue,
  type IssueSeverity,
  type ResolvedQueryOptions,
  resolveModelSize,
} from './types'
import { exec } from './executor'
import { createToolLogger } from './tool-logger'

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_REVIEW_CONFIG: Required<ReviewConfig> = {
  maxIterations: 3,
  maxDuration: 30 * 60 * 1000, // 30 minutes
  reviewers: ['code_reviewer', 'senior_engineer', 'security_auditor', 'mission_validator'],
  approvalThreshold: 'all',
  strictMode: true,
  autoRetry: true,
}

const MAX_TURNS_PER_REVIEWER = 20
const MAX_CONTINUATIONS = 3

// ============================================================================
// Reviewer Prompts
// ============================================================================

const REVIEWER_PROMPTS: Record<ReviewerType, { name: string; systemPrompt: string }> = {
  code_reviewer: {
    name: 'Code Reviewer',
    systemPrompt: `You are a STRICT and DEMANDING Code Reviewer. Your standards are HIGH.

## Your Mission
Review the code changes and identify ALL quality issues. Be thorough and critical.

## Review Criteria (Be STRICT on each)

### 1. Code Quality
- Is the code clean, readable, and self-documenting?
- Are variable/function names descriptive and consistent?
- Is there unnecessary complexity or over-engineering?
- Are there magic numbers or hardcoded values that should be constants?

### 2. DRY Principle
- Is there duplicated code that should be refactored?
- Are there reusable patterns not being leveraged?

### 3. Error Handling
- Are all error cases handled properly?
- Are errors informative and actionable?
- Are edge cases considered?

### 4. Code Organization
- Is the code well-structured and logically organized?
- Are files/modules appropriately sized?
- Is there proper separation of concerns?

### 5. Best Practices
- Does the code follow language/framework conventions?
- Are there anti-patterns being used?
- Is the code testable?

## Output Format
After your review, you MUST output a JSON block in this exact format:
\`\`\`json
{
  "verdict": "approved" | "needs_implementation" | "needs_testing",
  "confidence": 0-100,
  "issues": [
    {
      "severity": "critical" | "major" | "minor" | "suggestion",
      "category": "string",
      "file": "path/to/file",
      "line": 123,
      "description": "What's wrong",
      "suggestion": "How to fix it"
    }
  ],
  "mustFix": ["Critical item 1", "Critical item 2"],
  "suggestions": ["Nice to have 1"],
  "summary": "Overall assessment in 2-3 sentences"
}
\`\`\`

## Rules
- Be STRICT. If something is not right, flag it.
- "approved" only if code quality is genuinely excellent
- "needs_implementation" for fundamental issues requiring significant changes
- "needs_testing" if code logic seems fragile or undertested
- You are doing the developer a FAVOR by being strict`,
  },

  senior_engineer: {
    name: 'Senior Engineer',
    systemPrompt: `You are a SENIOR ENGINEER with 15+ years of experience. Your job is to evaluate ARCHITECTURE and DESIGN.

## Your Mission
Review the implementation for architectural soundness and long-term maintainability.

## Review Criteria (Be DEMANDING)

### 1. Architecture
- Is the overall design sound and scalable?
- Are the right abstractions being used?
- Is there proper layering (separation of concerns)?
- Will this design hold up under load/growth?

### 2. Maintainability
- Will another developer understand this code in 6 months?
- Is the code easy to modify without breaking things?
- Are dependencies well-managed?
- Is technical debt being introduced?

### 3. Performance
- Are there obvious performance issues?
- Are there N+1 queries or unnecessary loops?
- Is caching used appropriately?
- Are resources properly managed (connections, file handles)?

### 4. Scalability Concerns
- Will this work with 10x the data/users?
- Are there bottlenecks being introduced?
- Is the design horizontally scalable if needed?

### 5. Integration
- Does this integrate well with existing code?
- Are there breaking changes to APIs/interfaces?
- Is backward compatibility maintained where needed?

## Output Format
After your review, you MUST output a JSON block in this exact format:
\`\`\`json
{
  "verdict": "approved" | "needs_implementation" | "needs_testing",
  "confidence": 0-100,
  "issues": [
    {
      "severity": "critical" | "major" | "minor" | "suggestion",
      "category": "architecture" | "performance" | "maintainability" | "scalability",
      "file": "path/to/file",
      "line": 123,
      "description": "What's wrong",
      "suggestion": "How to fix it"
    }
  ],
  "mustFix": ["Critical architecture issues"],
  "suggestions": ["Future improvements"],
  "summary": "Architecture assessment in 2-3 sentences"
}
\`\`\`

## Rules
- Think like you're responsible for maintaining this code for years
- "approved" only if the architecture is genuinely solid
- "needs_implementation" for design flaws or poor abstractions
- "needs_testing" if the implementation needs more validation
- Your experience should make you SKEPTICAL by default`,
  },

  security_auditor: {
    name: 'Security Auditor',
    systemPrompt: `You are a SECURITY AUDITOR. Your job is to find VULNERABILITIES before attackers do.

## Your Mission
Audit the code changes for security issues. Assume attackers WILL try to exploit this code.

## Security Checklist (Check ALL)

### 1. Input Validation (OWASP A03)
- Is ALL user input validated and sanitized?
- Are there injection vulnerabilities (SQL, command, LDAP)?
- Is there proper encoding for output contexts (HTML, JS, URL)?

### 2. Authentication & Authorization (OWASP A01, A07)
- Are auth checks present and correct?
- Is there missing access control?
- Are there privilege escalation risks?
- Are sessions managed securely?

### 3. Sensitive Data (OWASP A02)
- Are secrets/credentials hardcoded?
- Is sensitive data properly encrypted?
- Are there information disclosure risks?
- Is PII handled according to best practices?

### 4. Configuration (OWASP A05)
- Are security headers set correctly?
- Are default credentials used?
- Is debug mode enabled in production?
- Are dependencies up to date?

### 5. Error Handling (OWASP A09)
- Do error messages leak sensitive information?
- Are stack traces exposed to users?
- Is logging appropriate (not too much, not too little)?

### 6. Cryptography
- Are secure algorithms used (not MD5, not SHA1 for passwords)?
- Are keys properly managed?
- Is randomness cryptographically secure?

## Output Format
After your security audit, you MUST output a JSON block in this exact format:
\`\`\`json
{
  "verdict": "approved" | "needs_implementation" | "rejected",
  "confidence": 0-100,
  "issues": [
    {
      "severity": "critical" | "major" | "minor" | "suggestion",
      "category": "injection" | "auth" | "data-exposure" | "crypto" | "config",
      "file": "path/to/file",
      "line": 123,
      "description": "Security issue description",
      "suggestion": "Remediation steps"
    }
  ],
  "mustFix": ["CRITICAL security items - MUST be fixed"],
  "suggestions": ["Security improvements"],
  "summary": "Security posture assessment"
}
\`\`\`

## Rules
- Any CRITICAL security issue = "rejected" or "needs_implementation"
- "approved" only if there are no security concerns
- Be PARANOID - assume the worst about user input
- Check for secrets in code, environment variables, configs`,
  },

  mission_validator: {
    name: 'Mission Validator',
    systemPrompt: `You are a MISSION VALIDATOR. Your job is to verify the implementation ACTUALLY fulfills the mission.

## Your Mission
Determine if the code changes fully implement what was requested. The user's mission must be COMPLETELY satisfied.

## Validation Criteria

### 1. Completeness
- Are ALL requirements from the mission addressed?
- Are there any missing features or partial implementations?
- Are edge cases handled as expected?

### 2. Correctness
- Does the implementation do what was asked?
- Are there logic errors that would cause wrong behavior?
- Does it work for the intended use cases?

### 3. User Experience
- Is the feature usable as intended?
- Are there obvious UX issues?
- Is the API/interface intuitive?

### 4. Documentation
- Is the implementation documented if needed?
- Are there comments explaining complex logic?
- Is the usage clear?

### 5. Testing
- Are there tests covering the new functionality?
- Do tests cover edge cases?
- Is test coverage adequate?

## Context
You will be given:
- The original MISSION (what the user asked for)
- The git diff showing changes made
- Access to read the codebase

## Output Format
After validation, you MUST output a JSON block in this exact format:
\`\`\`json
{
  "verdict": "approved" | "needs_implementation" | "needs_testing",
  "confidence": 0-100,
  "issues": [
    {
      "severity": "critical" | "major" | "minor" | "suggestion",
      "category": "completeness" | "correctness" | "ux" | "testing",
      "file": "path/to/file",
      "line": 123,
      "description": "What's missing or wrong",
      "suggestion": "What needs to be done"
    }
  ],
  "mustFix": ["Things that MUST be fixed to fulfill mission"],
  "suggestions": ["Nice to have improvements"],
  "summary": "Mission fulfillment assessment"
}
\`\`\`

## Rules
- Be the USER'S ADVOCATE - would they be satisfied?
- "approved" only if the mission is COMPLETELY fulfilled
- "needs_implementation" if core requirements are missing
- "needs_testing" if functionality exists but lacks validation
- Partial implementations are NOT acceptable`,
  },
}

// ============================================================================
// Review Context
// ============================================================================

export interface ReviewContext {
  projectPath: string
  mission: string
  config: ReviewConfig
  baseBranch?: string
  currentBranch?: string
  iteration?: number
}

// ============================================================================
// Helper Functions
// ============================================================================

async function getGitDiff(projectPath: string, baseBranch?: string): Promise<string> {
  try {
    if (baseBranch) {
      const result = await exec(`git diff ${baseBranch}...HEAD`, projectPath)
      return result.stdout
    } else {
      // Get diff of all changes in the branch
      const result = await exec(`git diff HEAD~10..HEAD 2>/dev/null || git diff HEAD`, projectPath)
      return result.stdout
    }
  } catch {
    return ''
  }
}

async function getChangedFiles(projectPath: string): Promise<string[]> {
  try {
    const result = await exec(`git diff --name-only HEAD~10..HEAD 2>/dev/null || git diff --name-only HEAD`, projectPath)
    return result.stdout.split('\n').filter(Boolean)
  } catch {
    return []
  }
}

function parseReviewerOutput(output: string): Omit<ReviewerResult, 'reviewer' | 'timestamp'> | null {
  // Extract JSON from the output
  const jsonMatch = output.match(/```json\s*([\s\S]*?)\s*```/)
  if (!jsonMatch) {
    // Try to find raw JSON
    const rawJsonMatch = output.match(/\{[\s\S]*"verdict"[\s\S]*\}/)
    if (!rawJsonMatch) {
      return null
    }
    try {
      return JSON.parse(rawJsonMatch[0])
    } catch {
      return null
    }
  }

  try {
    return JSON.parse(jsonMatch[1])
  } catch {
    return null
  }
}

function aggregateVerdicts(results: ReviewerResult[], threshold: 'all' | 'majority' | 'any'): ReviewVerdict {
  const verdicts = results.map((r) => r.verdict)

  // If any reviewer rejects, the whole thing is rejected
  if (verdicts.includes('rejected')) {
    return 'rejected'
  }

  // Count approvals
  const approvalCount = verdicts.filter((v) => v === 'approved').length
  const needsImplCount = verdicts.filter((v) => v === 'needs_implementation').length
  const needsTestCount = verdicts.filter((v) => v === 'needs_testing').length

  switch (threshold) {
    case 'all':
      if (approvalCount === results.length) return 'approved'
      if (needsImplCount > 0) return 'needs_implementation'
      if (needsTestCount > 0) return 'needs_testing'
      return 'needs_implementation' // Default if unclear

    case 'majority':
      if (approvalCount > results.length / 2) return 'approved'
      if (needsImplCount > results.length / 2) return 'needs_implementation'
      if (needsTestCount > results.length / 2) return 'needs_testing'
      // No majority - take worst case
      if (needsImplCount > 0) return 'needs_implementation'
      if (needsTestCount > 0) return 'needs_testing'
      return 'approved'

    case 'any':
      if (approvalCount > 0) return 'approved'
      if (needsImplCount > 0) return 'needs_implementation'
      if (needsTestCount > 0) return 'needs_testing'
      return 'needs_implementation'

    default:
      return 'needs_implementation'
  }
}

function generateFeedback(results: ReviewerResult[]): string {
  const criticalIssues = results.flatMap((r) => r.issues.filter((i) => i.severity === 'critical'))
  const majorIssues = results.flatMap((r) => r.issues.filter((i) => i.severity === 'major'))
  const mustFix = results.flatMap((r) => r.mustFix)

  let feedback = '## Review Feedback\n\n'

  if (mustFix.length > 0) {
    feedback += '### MUST FIX (Critical)\n'
    mustFix.forEach((item) => {
      feedback += `- ${item}\n`
    })
    feedback += '\n'
  }

  if (criticalIssues.length > 0) {
    feedback += '### Critical Issues\n'
    criticalIssues.forEach((issue) => {
      feedback += `- **[${issue.category}]** ${issue.file}${issue.line ? `:${issue.line}` : ''}\n`
      feedback += `  ${issue.description}\n`
      if (issue.suggestion) {
        feedback += `  → ${issue.suggestion}\n`
      }
    })
    feedback += '\n'
  }

  if (majorIssues.length > 0) {
    feedback += '### Major Issues\n'
    majorIssues.forEach((issue) => {
      feedback += `- **[${issue.category}]** ${issue.file}${issue.line ? `:${issue.line}` : ''}\n`
      feedback += `  ${issue.description}\n`
      if (issue.suggestion) {
        feedback += `  → ${issue.suggestion}\n`
      }
    })
    feedback += '\n'
  }

  // Add summaries from each reviewer
  feedback += '### Reviewer Summaries\n'
  results.forEach((r) => {
    const reviewerInfo = REVIEWER_PROMPTS[r.reviewer]
    feedback += `- **${reviewerInfo?.name || r.reviewer}**: ${r.summary}\n`
  })

  return feedback
}

// ============================================================================
// Single Reviewer Execution
// ============================================================================

async function* runSingleReviewer(
  reviewerType: ReviewerType,
  context: ReviewContext,
  queryOptions?: ResolvedQueryOptions
): AsyncGenerator<PolishEvent, ReviewerResult | null> {
  const reviewerInfo = REVIEWER_PROMPTS[reviewerType]
  if (!reviewerInfo) {
    yield { type: 'error', data: { message: `Unknown reviewer type: ${reviewerType}` } }
    return null
  }

  yield {
    type: 'reviewer_start',
    data: {
      reviewer: reviewerType,
      iteration: context.iteration || 1,
    },
  }

  // Get git diff and changed files
  const [gitDiff, changedFiles] = await Promise.all([
    getGitDiff(context.projectPath, context.baseBranch),
    getChangedFiles(context.projectPath),
  ])

  // Build the prompt for the reviewer
  const userPrompt = `## Mission Being Reviewed
${context.mission}

## Changed Files
${changedFiles.join('\n')}

## Git Diff
\`\`\`diff
${gitDiff.slice(0, 50000)}
\`\`\`

Please review these changes according to your expertise and provide your verdict.
Use the Read tool to examine any files in detail if needed.
Focus on files that were changed.

After your analysis, output your verdict in the JSON format specified in your instructions.`

  // Build system prompt
  const systemPrompt = {
    type: 'preset' as const,
    preset: 'claude_code' as const,
    append: `${reviewerInfo.systemPrompt}\n\nYou are reviewing code in: ${context.projectPath}`,
  }

  // Create tool logger
  const toolLogger = createToolLogger('minimal')

  let output = ''
  let continuations = 0

  try {
    while (continuations < MAX_CONTINUATIONS) {
      const result: QueryResult = await query({
        prompt: continuations === 0 ? userPrompt : 'Please continue your review and provide your final verdict.',
        options: {
          model: resolveModelSize('medium'),
          maxTurns: MAX_TURNS_PER_REVIEWER,
          systemPrompt,
          cwd: context.projectPath,
          permissionMode: 'bypassPermissions',
          ...queryOptions,
          tools: ['Read', 'Glob', 'Grep', 'Bash'],
          allowedTools: ['Read', 'Glob', 'Grep', 'Bash'],
          hooks: {
            PreToolUse: [{ hooks: [toolLogger.hook] }],
            PostToolUse: [{ hooks: [toolLogger.hook] }],
          },
        },
      })

      // Extract text from result
      for (const message of result.messages) {
        if (message.role === 'assistant') {
          for (const block of message.content) {
            if (block.type === 'text') {
              output += block.text
            }
          }
        }
      }

      // Emit agent activity
      yield {
        type: 'agent',
        data: {
          message: `${reviewerInfo.name} reviewed ${changedFiles.length} files`,
        },
      }

      // Check if output is incomplete (needs continuation)
      if (result.stopReason === 'max_turns') {
        continuations++
        continue
      }

      break
    }

    // Parse the output
    const parsed = parseReviewerOutput(output)
    if (!parsed) {
      yield {
        type: 'error',
        data: { message: `Failed to parse ${reviewerInfo.name}'s review output` },
      }
      return null
    }

    // Add missing fields and reviewer info
    const reviewerResult: ReviewerResult = {
      reviewer: reviewerType,
      verdict: parsed.verdict || 'needs_implementation',
      confidence: parsed.confidence || 50,
      issues: (parsed.issues || []).map((issue: Partial<ReviewIssue>) => ({
        id: uuidv4(),
        severity: issue.severity || 'minor' as IssueSeverity,
        category: issue.category || 'general',
        file: issue.file,
        line: issue.line,
        description: issue.description || '',
        suggestion: issue.suggestion,
        reviewer: reviewerType,
      })),
      summary: parsed.summary || '',
      mustFix: parsed.mustFix || [],
      suggestions: parsed.suggestions || [],
      timestamp: new Date(),
    }

    yield {
      type: 'reviewer_result',
      data: {
        result: reviewerResult,
        iteration: context.iteration || 1,
      },
    }

    return reviewerResult
  } catch (error) {
    yield {
      type: 'error',
      data: {
        message: `${reviewerInfo.name} encountered an error: ${error instanceof Error ? error.message : String(error)}`,
      },
    }
    return null
  }
}

// ============================================================================
// Main Review Phase
// ============================================================================

export interface ReviewPhaseOptions {
  context: ReviewContext
  queryOptions?: ResolvedQueryOptions
}

export async function* runReviewPhase(
  options: ReviewPhaseOptions
): AsyncGenerator<PolishEvent, ReviewPhaseResult> {
  const { context, queryOptions } = options
  const config = { ...DEFAULT_REVIEW_CONFIG, ...context.config }
  const startTime = Date.now()

  yield {
    type: 'phase',
    data: { phase: 'review', mission: context.mission },
  }

  yield {
    type: 'review_start',
    data: {
      iteration: context.iteration || 1,
      reviewers: config.reviewers,
      config,
    },
  }

  // Run all reviewers
  const results: ReviewerResult[] = []

  for (const reviewerType of config.reviewers) {
    // Check timeout
    if (Date.now() - startTime > config.maxDuration) {
      yield {
        type: 'status',
        data: {
          phase: 'review',
          message: `Review timed out after ${config.maxDuration / 1000}s`,
        },
      }
      break
    }

    const reviewerGen = runSingleReviewer(reviewerType, context, queryOptions)
    let reviewerResult: ReviewerResult | null = null

    // Iterate through the generator, yielding events and capturing the final return value
    let iterResult = await reviewerGen.next()
    while (!iterResult.done) {
      yield iterResult.value
      iterResult = await reviewerGen.next()
    }

    // The final value is the return value of the generator
    if (iterResult.value) {
      reviewerResult = iterResult.value
    }

    if (reviewerResult) {
      results.push(reviewerResult)
    }
  }

  // Aggregate verdicts
  const finalVerdict = aggregateVerdicts(results, config.approvalThreshold)
  const allIssues = results.flatMap((r) => r.issues)
  const criticalIssues = allIssues.filter((i) => i.severity === 'critical')
  const mustFixItems = results.flatMap((r) => r.mustFix)

  // Determine which phase to return to if not approved
  let returnToPhase: 'implement' | 'testing' | undefined
  if (finalVerdict === 'needs_implementation') {
    returnToPhase = 'implement'
  } else if (finalVerdict === 'needs_testing') {
    returnToPhase = 'testing'
  }

  // Generate feedback for next phase
  const feedbackForNextPhase = returnToPhase ? generateFeedback(results) : undefined

  // Emit verdict
  yield {
    type: 'review_verdict',
    data: {
      verdict: finalVerdict,
      totalIssues: allIssues.length,
      criticalIssues: criticalIssues.length,
      mustFixItems,
      returnToPhase,
      feedbackSummary: generateFeedback(results),
      iteration: context.iteration || 1,
    },
  }

  const result: ReviewPhaseResult = {
    finalVerdict,
    reviewers: results,
    totalIssues: allIssues.length,
    criticalIssues: criticalIssues.length,
    mustFixItems,
    iterationNumber: context.iteration || 1,
    returnToPhase,
    feedbackForNextPhase,
  }

  return result
}

// ============================================================================
// Exports
// ============================================================================

export { REVIEWER_PROMPTS, DEFAULT_REVIEW_CONFIG }
