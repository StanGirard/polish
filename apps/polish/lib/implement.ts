import {
  query,
  type HookCallback,
  type PreToolUseHookInput,
  type PostToolUseHookInput
} from '@anthropic-ai/claude-agent-sdk'
import { commitWithMessage, getStatus } from './git'
import type { AgentEventData, PlanStep, PolishEvent, ResolvedQueryOptions } from './types'
import { createToolLogger } from './tool-logger'

// ============================================================================
// Implementation Phase (Phase 1)
// ============================================================================

interface ImplementPromptOptions {
  mission: string
  approvedPlan?: PlanStep[]
  feedback?: string
  retryCount?: number
}

function buildImplementPrompt(options: ImplementPromptOptions): string {
  const { mission, approvedPlan, feedback, retryCount } = options

  let prompt = `You need to implement the following feature in this project:

## Mission
${mission}
`

  // Include the approved plan if available
  if (approvedPlan && approvedPlan.length > 0) {
    prompt += `
## Approved Implementation Plan
Follow these steps in order. Each step has been reviewed and approved:

`
    for (const step of approvedPlan) {
      prompt += `### Step ${step.order}: ${step.title}
${step.description}
`
      if (step.files.length > 0) {
        prompt += `**Files:** ${step.files.join(', ')}
`
      }
      if (step.dependencies && step.dependencies.length > 0) {
        prompt += `**Depends on:** ${step.dependencies.join(', ')}
`
      }
      if (step.complexity) {
        prompt += `**Complexity:** ${step.complexity}
`
      }
      if (step.acceptanceCriteria && step.acceptanceCriteria.length > 0) {
        prompt += `**Acceptance criteria:**
${step.acceptanceCriteria.map(c => `- ${c}`).join('\n')}
`
      }
      prompt += '\n'
    }
  }

  // Add feedback if this is a retry
  if (feedback && retryCount && retryCount > 0) {
    prompt += `
## User Feedback (Attempt #${retryCount + 1})
The user was not satisfied with the previous implementation. Here is their feedback:

> ${feedback}

**Important**: Take this feedback into account and fix/improve the implementation accordingly.
Analyze what was done previously and apply the requested corrections.
`
  }

  prompt += `
## Instructions
1. First, explore the project with Glob and Read to understand:
   - The project structure
   - The patterns and conventions used
   - The relevant files to modify or create
${feedback ? '   - What was already implemented (for the retry)\n' : ''}
2. Then, implement the feature:
   - Create new files as needed with Write
   - Modify existing files with Edit
   - Make sure the code compiles (no syntax errors)
${feedback ? '   - Apply the corrections requested in the feedback\n' : ''}
3. The code can be imperfect:
   - Warnings are acceptable
   - Incomplete types are acceptable
   - The code will be polished automatically afterward

## Important
- Follow the existing project conventions
- Use the patterns already in place
- Prefer Edit over Write for modifying existing files
- Don't touch config files without reason
${feedback ? '- PRIORITY: Address user feedback first\n' : ''}
Start by exploring the project, then implement the feature.`

  return prompt
}

const IMPLEMENT_SYSTEM_PROMPT = `You are an expert developer. Your mission is to implement a feature in an existing project.

## Your Approach
1. **Explore** - Understand the project, its structure, its patterns
2. **Plan** - Identify files to create/modify
3. **Implement** - Write the necessary code
4. **Verify** - Make sure the code compiles

## Available Tools
- Glob: find files by pattern
- Grep: search text in files
- Read: read a file
- Write: create a new file
- Edit: modify an existing file (preferred over Write for modifications)
- Bash: run commands (npm, tsc, etc.)

## Rules
- Follow project conventions
- Code must compile (no syntax errors)
- Warnings and incomplete types are acceptable
- Prefer incremental changes`

export interface ImplementPhaseOptions {
  mission: string
  projectPath: string
  approvedPlan?: PlanStep[]
  feedback?: string
  retryCount?: number
  queryOptions?: ResolvedQueryOptions
}

export async function* runImplementPhase(
  options: ImplementPhaseOptions
): AsyncGenerator<PolishEvent> {
  const { mission, projectPath, approvedPlan, feedback, retryCount, queryOptions } = options
  // Track files modified by the agent
  const filesCreated: string[] = []
  const filesModified: string[] = []
  const hookEvents: PolishEvent[] = []

  // Initialize tool logger
  const logLevel = process.env.TOOL_LOG_LEVEL as 'minimal' | 'normal' | 'verbose' | 'debug' || 'normal'
  const { tracker: toolTracker, hook: toolLoggerHook } = createToolLogger(logLevel)

  const toolHook: HookCallback = async (input) => {
    if (input.hook_event_name !== 'PreToolUse' && input.hook_event_name !== 'PostToolUse') {
      return {}
    }

    // Log tool call with enhanced logger
    await toolLoggerHook(input)

    const toolInput = input as PreToolUseHookInput | PostToolUseHookInput
    const eventData: AgentEventData = {
      tool: toolInput.tool_name,
      input: toolInput.tool_input,
      phase: toolInput.hook_event_name
    }

    // Track file operations
    if (toolInput.hook_event_name === 'PostToolUse') {
      eventData.output = (toolInput as PostToolUseHookInput).tool_response

      // Track Write operations (new files)
      if (toolInput.tool_name === 'Write') {
        const filePath = (toolInput.tool_input as { file_path?: string })?.file_path
        if (filePath && !filesCreated.includes(filePath)) {
          filesCreated.push(filePath)
        }
      }

      // Track Edit operations (modified files)
      if (toolInput.tool_name === 'Edit') {
        const filePath = (toolInput.tool_input as { file_path?: string })?.file_path
        if (filePath && !filesModified.includes(filePath) && !filesCreated.includes(filePath)) {
          filesModified.push(filePath)
        }
      }
    }

    hookEvents.push({ type: 'agent', data: eventData })
    return {}
  }

  try {
    // Start implement phase
    yield {
      type: 'phase',
      data: { phase: 'implement', mission }
    }

    yield {
      type: 'status',
      data: { phase: 'implement', message: 'Starting implementation...' }
    }

    // Auto-continuation support
    const MAX_CONTINUATIONS = 5
    let sessionId: string | undefined
    let continuationCount = 0
    let shouldContinue = true

    while (shouldContinue && continuationCount <= MAX_CONTINUATIONS) {
      const isResume = sessionId !== undefined
      const prompt = isResume
        ? 'Continue implementing the remaining features.'
        : buildImplementPrompt({ mission, approvedPlan, feedback, retryCount })

      // Default tools for implement phase
      const defaultAllowedTools = ['Read', 'Write', 'Edit', 'Bash', 'Glob', 'Grep']

      for await (const message of query({
        prompt,
        options: {
          cwd: projectPath,
          systemPrompt: queryOptions?.systemPrompt || IMPLEMENT_SYSTEM_PROMPT,
          // Use resolved tools or defaults
          tools: queryOptions?.tools,
          allowedTools: queryOptions?.allowedTools || defaultAllowedTools,
          disallowedTools: queryOptions?.disallowedTools,
          // MCP servers and plugins from capabilities
          mcpServers: queryOptions?.mcpServers,
          plugins: queryOptions?.plugins,
          agents: queryOptions?.agents,
          settingSources: queryOptions?.settingSources,
          permissionMode: 'acceptEdits',
          maxTurns: 30,
          maxThinkingTokens: 16000,
          resume: sessionId,
          hooks: {
            PreToolUse: [{ hooks: [toolHook] }],
            PostToolUse: [{ hooks: [toolHook] }]
          }
        }
      })) {
        // Yield hook events
        while (hookEvents.length > 0) {
          yield hookEvents.shift()!
        }

        // Process SDK messages
        if (message.type === 'assistant' && message.message?.content) {
          for (const block of message.message.content) {
            if ('text' in block) {
              yield {
                type: 'agent',
                data: { message: block.text }
              }
            }
          }
        } else if (message.type === 'result') {
          if (message.subtype === 'error_max_turns') {
            // Hit max turns - capture session and continue
            sessionId = message.session_id
            continuationCount++

            yield {
              type: 'status',
              data: {
                phase: 'implement',
                message: `Continuing implementation (${continuationCount}/${MAX_CONTINUATIONS})...`
              }
            }
            break // Break inner loop, continue outer while loop
          } else {
            // Success or other completion - exit
            yield {
              type: 'status',
              data: {
                phase: 'implement',
                message: message.subtype === 'success'
                  ? 'Implementation complete'
                  : `Implementation stopped: ${message.subtype}`
              }
            }
            shouldContinue = false
          }
        }
      }
    }

    if (continuationCount > MAX_CONTINUATIONS) {
      yield {
        type: 'status',
        data: {
          phase: 'implement',
          message: 'Implementation reached maximum continuations limit'
        }
      }
    }

    // Check if any files were modified
    const status = await getStatus(projectPath)
    if (!status.hasChanges && filesCreated.length === 0 && filesModified.length === 0) {
      yield {
        type: 'status',
        data: { phase: 'implement', message: 'No changes made during implementation' }
      }
      return
    }

    // Create a summary commit message
    const shortMission = mission.length > 50 ? mission.slice(0, 47) + '...' : mission
    const commitMessage = `feat: ${shortMission} (WIP)`
    const commitHash = await commitWithMessage(projectPath, commitMessage)

    yield {
      type: 'implement_done',
      data: {
        commitHash,
        message: commitMessage,
        filesCreated,
        filesModified
      }
    }

    yield {
      type: 'status',
      data: {
        phase: 'implement',
        message: `Committed: ${commitMessage}`
      }
    }

    // Log tool call statistics at the end
    if (logLevel === 'verbose' || logLevel === 'debug') {
      const summary = toolTracker.getSummary()
      console.log(summary)
    }

  } catch (error) {
    yield {
      type: 'error',
      data: {
        message: `Implementation failed: ${error instanceof Error ? error.message : String(error)}`
      }
    }
  }
}
