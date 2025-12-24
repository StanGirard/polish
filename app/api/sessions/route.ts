import { NextRequest, NextResponse } from 'next/server'
import {
  createSession,
  getAllSessions,
  updateSession,
  addEvent,
  addPlanMessage,
  type Session
} from '@/lib/session-store'
import { runIsolatedPolish } from '@/lib/loop'
import { runPlanningPhase, type PlanningContext } from '@/lib/planner'
import { loadPreset } from '@/lib/scorer'
import { resolveCapabilitiesForPhase } from '@/lib/capabilities'
import type { PolishConfig, PolishEvent, CapabilityOverride } from '@/lib/types'

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
      enablePlanning = false  // Enable interactive planning phase
    } = body as {
      mission?: string
      projectPath?: string
      maxDuration?: number
      maxThinkingTokens?: number
      capabilityOverrides?: CapabilityOverride[]
      enablePlanning?: boolean
    }

    // Create session in DB
    const session = createSession({
      mission: mission?.trim() || undefined,
      projectPath,
      enablePlanning
    })

    if (enablePlanning && mission) {
      // Start in planning mode - don't run implementation yet
      // Launch planning in background
      runPlanningInBackground(session.id, mission.trim(), projectPath)

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
      capabilityOverrides
    })

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

// Background job runner
async function runPolishInBackground(sessionId: string, config: PolishConfig) {
  const startTime = Date.now()
  let commits = 0
  let initialScore: number | undefined
  let finalScore: number | undefined
  let branchName: string | undefined

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

      // Review gate events (Phase 3)
      if (event.type === 'review_start') {
        updateSession(sessionId, {
          status: 'reviewing',
          reviewIteration: event.data.iteration
        })
      }

      if (event.type === 'review_complete') {
        updateSession(sessionId, {
          reviewApproved: event.data.approved,
          // Don't change status here - let result event handle it
        })
      }

      if (event.type === 'review_redirect') {
        updateSession(sessionId, {
          lastReviewFeedback: event.data.feedback,
          status: 'running' // Back to running for next iteration
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
  }
}

// Background job for planning phase
async function runPlanningInBackground(
  sessionId: string,
  mission: string,
  projectPath: string
) {
  try {
    // Load preset for capabilities
    const preset = await loadPreset(projectPath)
    const planningOptions = resolveCapabilitiesForPhase(preset, 'planning')

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

      // If we got a plan, update status to awaiting_approval
      if (event.type === 'plan') {
        updateSession(sessionId, { status: 'awaiting_approval' })
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
  }
}
