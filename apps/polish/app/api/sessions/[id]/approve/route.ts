import { NextRequest, NextResponse } from 'next/server'
import {
  getSession,
  updateSession,
  addEvent
} from '@/lib/session-store'
import { runIsolatedPolish } from '@/lib/loop'
import type { PolishConfig, PolishEvent, PlanStep } from '@/lib/types'

type RouteParams = { params: Promise<{ id: string }> }

interface ApproveRequest {
  plan?: PlanStep[]  // Optional: the approved plan steps
  maxDuration?: number
}

// POST /api/sessions/[id]/approve - Approve the plan and start implementation
export async function POST(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { id } = await params
    const session = getSession(id)

    if (!session) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      )
    }

    // Only allow approval during awaiting_approval phase
    if (session.status !== 'awaiting_approval') {
      return NextResponse.json(
        { error: 'Session is not awaiting approval' },
        { status: 400 }
      )
    }

    // Must have a mission
    if (!session.mission) {
      return NextResponse.json(
        { error: 'Cannot approve a session without a mission' },
        { status: 400 }
      )
    }

    const body = await request.json() as ApproveRequest

    // Determine which plan to use
    let approvedPlan: PlanStep[] = []

    if (body.plan) {
      // Direct plan provided
      approvedPlan = body.plan
      updateSession(id, { approvedPlan })
    } else {
      // Fallback to existing approved plan (parsed from markdown)
      approvedPlan = session.approvedPlan || []
    }

    // Emit plan approved event
    const approvedEvent: PolishEvent = {
      type: 'plan_approved',
      data: {
        plan: approvedPlan,
        approvedAt: new Date().toISOString()
      }
    }
    addEvent(id, approvedEvent)

    // Update status to running
    updateSession(id, { status: 'running' })
    runImplementationInBackground(id, {
      projectPath: session.projectPath,
      mission: session.mission,
      approvedPlan, // Pass the approved plan to the implementation phase
      maxDuration: body.maxDuration || 2 * 60 * 60 * 1000, // 2 hours default
      isolation: {
        enabled: true,
        existingBranch: session.branchName
      },
      enablePlanning: false, // Planning is done, skip to implementation
      selectedMcpIds: session.selectedMcpIds // Pass through MCP servers
    })

    return NextResponse.json({
      success: true,
      sessionId: id,
      message: 'Plan approved, implementation started'
    })
  } catch (error) {
    console.error('Failed to approve plan:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to approve plan' },
      { status: 500 }
    )
  }
}

// Background job for implementation after approval
async function runImplementationInBackground(sessionId: string, config: PolishConfig) {
  const startTime = Date.now()
  let commits = 0
  let finalScore: number | undefined
  let branchName: string | undefined

  try {
    for await (const event of runIsolatedPolish(config)) {
      // Store event in DB and notify subscribers
      addEvent(sessionId, event)

      // Track session state from events
      if (event.type === 'score') {
        finalScore = event.data.score
        updateSession(sessionId, { finalScore })
      }

      if (event.type === 'init') {
        updateSession(sessionId, { initialScore: event.data.initialScore })
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
    const session = getSession(sessionId)
    if (session && session.status === 'running') {
      updateSession(sessionId, {
        status: 'completed',
        completedAt: new Date(),
        duration: Date.now() - startTime
      })
    }
  } catch (error) {
    console.error(`Implementation for session ${sessionId} failed:`, error)

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
