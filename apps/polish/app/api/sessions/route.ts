import { NextRequest, NextResponse } from 'next/server'
import {
  createSession,
  getAllSessions,
  updateSession,
  addEvent,
  addPlanMessage,
  waitForSubscriber,
  type Session
} from '@/lib/session-store'
import { runIsolatedPolish } from '@/lib/loop'
import { runPlanningPhase, type PlanningContext } from '@/lib/planner'
import { loadPreset } from '@/lib/scorer'
import { resolveCapabilitiesForPhase } from '@/lib/capabilities'
import { getProvider, getDefaultProvider } from '@/lib/provider-store'
import { setProviderEnvironment, clearProviderEnvironment, getProviderFromEnvironment } from '@/lib/provider-runtime'
import type { PolishConfig, PolishEvent, CapabilityOverride, Provider, PlanEventData } from '@/lib/types'

export const maxDuration = 300 // 5 min max (Vercel limit)

// GET /api/sessions - List all sessions
export async function GET() {
  try {
    const sessions = getAllSessions()
    return NextResponse.json({ sessions })
  } catch (error) {
    console.error('Failed to get sessions:', error)
    return NextResponse.json(
      { error: 'Failed to get sessions' },
      { status: 500 }
    )
  }
}

// POST /api/sessions - Create and start a new session
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      mission,
      projectPath = process.cwd(),
      maxDuration: duration = 5 * 60 * 1000,
      maxThinkingTokens = 16000,
      capabilityOverrides,
      enablePlanning = false,  // Enable interactive planning phase
      providerId,  // Optional: specific provider to use
      selectedMcpIds  // Optional: IDs of global MCP servers to use
    } = body as {
      mission?: string
      projectPath?: string
      maxDuration?: number
      maxThinkingTokens?: number
      capabilityOverrides?: CapabilityOverride[]
      enablePlanning?: boolean
      providerId?: string
      selectedMcpIds?: string[]
    }

    // Resolve provider (specific, default from DB, or from env vars)
    const provider = resolveProvider(providerId)

    // Create session in DB
    const session = createSession({
      mission: mission?.trim() || undefined,
      projectPath,
      enablePlanning,
      providerId: provider?.id !== 'env' ? provider?.id : undefined,
      selectedMcpIds
    })

    if (enablePlanning && mission) {
      // Start in planning mode - don't run implementation yet
      // Launch planning in background
      runPlanningInBackground(session.id, mission.trim(), projectPath, provider, selectedMcpIds)

      return NextResponse.json({
        sessionId: session.id,
        session,
        message: 'Session created in planning mode. Review the plan and approve to start implementation.'
      })
    }

    // Standard flow: Update to running and start implementation
    updateSession(session.id, { status: 'running' })

    // Launch polish in background (fire and forget)
    runPolishInBackground(session.id, {
      projectPath,
      mission: mission?.trim() || undefined,
      maxDuration: duration,
      maxThinkingTokens,
      isolation: { enabled: true },
      capabilityOverrides,
      selectedMcpIds
    }, provider)

    return NextResponse.json({
      sessionId: session.id,
      session: { ...session, status: 'running' }
    })
  } catch (error) {
    console.error('Failed to create session:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create session' },
      { status: 500 }
    )
  }
}

/**
 * Resolve provider: specific ID > default from DB > env vars
 */
function resolveProvider(providerId?: string): Provider | undefined {
  // If specific provider requested, use it
  if (providerId) {
    const provider = getProvider(providerId)
    if (provider) return provider
    console.warn(`Provider ${providerId} not found, falling back to default`)
  }

  // Try default provider from DB
  const defaultProvider = getDefaultProvider()
  if (defaultProvider) return defaultProvider

  // Fall back to environment variables
  return getProviderFromEnvironment()
}

// Background job runner
async function runPolishInBackground(sessionId: string, config: PolishConfig, provider?: Provider) {
  const startTime = Date.now()
  let commits = 0
  let initialScore: number | undefined
  let finalScore: number | undefined
  let branchName: string | undefined

  // Set provider environment if available
  if (provider) {
    setProviderEnvironment(provider)
  }

  try {
    for await (const event of runIsolatedPolish(config)) {
      // Store event in DB and notify subscribers
      addEvent(sessionId, event)

      // Track session state from events
      if (event.type === 'init') {
        initialScore = event.data.initialScore
        updateSession(sessionId, { initialScore })
      }

      if (event.type === 'score') {
        finalScore = event.data.score
        updateSession(sessionId, { finalScore })
      }

      if (event.type === 'commit') {
        commits++
        updateSession(sessionId, { commits })
      }

      if (event.type === 'worktree_created') {
        branchName = event.data.branchName
        updateSession(sessionId, { branchName })
      }

      if (event.type === 'worktree_cleanup') {
        if (event.data.kept && event.data.branchName) {
          branchName = event.data.branchName
          updateSession(sessionId, { branchName })
        }
      }

      if (event.type === 'result') {
        const duration = Date.now() - startTime
        updateSession(sessionId, {
          status: event.data.success ? 'completed' : 'failed',
          completedAt: new Date(),
          duration,
          finalScore: event.data.finalScore,
          commits: event.data.commits.length
        })
      }

      if (event.type === 'error') {
        updateSession(sessionId, {
          status: 'failed',
          completedAt: new Date(),
          duration: Date.now() - startTime
        })
      }
    }

    // If no result event was sent, mark as completed
    const session = await import('@/lib/session-store').then(m => m.getSession(sessionId))
    if (session && session.status === 'running') {
      updateSession(sessionId, {
        status: 'completed',
        completedAt: new Date(),
        duration: Date.now() - startTime
      })
    }
  } catch (error) {
    console.error(`Session ${sessionId} failed:`, error)

    // Store error event
    const errorEvent: PolishEvent = {
      type: 'error',
      data: { message: error instanceof Error ? error.message : 'Unknown error' }
    }
    addEvent(sessionId, errorEvent)

    updateSession(sessionId, {
      status: 'failed',
      completedAt: new Date(),
      duration: Date.now() - startTime
    })
  } finally {
    // Clean up provider environment
    if (provider) {
      clearProviderEnvironment()
    }
  }
}

// Background job for planning phase
async function runPlanningInBackground(
  sessionId: string,
  mission: string,
  projectPath: string,
  provider?: Provider,
  selectedMcpIds?: string[]
) {
  // Set provider environment if available
  if (provider) {
    setProviderEnvironment(provider)
  }

  try {
    // Wait for a subscriber to connect (with 5 second timeout)
    await waitForSubscriber(sessionId, 5000)

    // Load preset for capabilities
    const preset = await loadPreset(projectPath)
    const planningOptions = resolveCapabilitiesForPhase(preset, 'planning', [], selectedMcpIds)

    const context: PlanningContext = {
      mission,
      projectPath,
      messages: []
    }

    // Emit phase event
    addEvent(sessionId, {
      type: 'phase',
      data: { phase: 'planning', mission }
    })

    // Run planning phase
    for await (const event of runPlanningPhase(context, planningOptions)) {
      addEvent(sessionId, event)

      // If we got a plan, store markdown and update status to awaiting_approval
      if (event.type === 'plan') {
        const planData = event.data as PlanEventData
        updateSession(sessionId, {
          status: 'awaiting_approval',
          planMarkdown: planData.markdown
        })
      }

      // Store assistant messages
      if (event.type === 'plan_message' && event.data.message.role === 'assistant') {
        addPlanMessage(sessionId, event.data.message)
      }

      if (event.type === 'error') {
        updateSession(sessionId, { status: 'failed' })
      }
    }
  } catch (error) {
    console.error(`Planning for session ${sessionId} failed:`, error)

    const errorEvent: PolishEvent = {
      type: 'error',
      data: { message: error instanceof Error ? error.message : 'Unknown error' }
    }
    addEvent(sessionId, errorEvent)

    updateSession(sessionId, { status: 'failed' })
  } finally {
    // Clean up provider environment
    if (provider) {
      clearProviderEnvironment()
    }
  }
}
