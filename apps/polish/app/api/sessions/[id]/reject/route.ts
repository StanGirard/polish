import { NextRequest, NextResponse } from 'next/server'
import {
  getSession,
  updateSession,
  addEvent,
  addPlanMessage,
  getPlanMessages,
  clearPlanMessages
} from '@/lib/session-store'
import { runPlanningPhase, type PlanningContext } from '@/lib/planner'
import { loadPreset } from '@/lib/scorer'
import { resolveCapabilitiesForPhase } from '@/lib/capabilities'
import type { PlanMessage, PolishEvent } from '@/lib/types'

type RouteParams = { params: Promise<{ id: string }> }

interface RejectRequest {
  reason?: string  // If provided, restart planning. If empty/missing, abort session.
}

// POST /api/sessions/[id]/reject - Reject the plan
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

    // Only allow rejection during planning or awaiting_approval phases
    if (!['planning', 'awaiting_approval'].includes(session.status)) {
      return NextResponse.json(
        { error: 'Session is not in planning phase' },
        { status: 400 }
      )
    }

    const body = await request.json() as RejectRequest
    const reason = body.reason?.trim()

    // Emit rejection event
    const rejectedEvent: PolishEvent = {
      type: 'plan_rejected',
      data: {
        reason,
        rejectedAt: new Date().toISOString()
      }
    }
    addEvent(id, rejectedEvent)

    if (!reason) {
      // No reason provided - abort the session
      updateSession(id, {
        status: 'cancelled',
        completedAt: new Date()
      })

      return NextResponse.json({
        success: true,
        sessionId: id,
        action: 'aborted',
        message: 'Session aborted'
      })
    }

    // Reason provided - restart planning with feedback
    if (!session.mission) {
      return NextResponse.json(
        { error: 'Cannot restart planning without a mission' },
        { status: 400 }
      )
    }

    // Add rejection as user message
    const rejectionMessage: PlanMessage = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: `[PLAN REJECTED]\n\nRaison du rejet: ${reason}\n\nMerci de réviser le plan en tenant compte de ce feedback.`,
      timestamp: new Date().toISOString()
    }
    addPlanMessage(id, rejectionMessage)

    // Update status back to planning
    updateSession(id, {
      status: 'planning',
      approvedPlan: undefined  // Clear any previous plan
    })

    // Restart planning in background
    runPlanningRestartInBackground(id, session.mission, session.projectPath, reason)

    return NextResponse.json({
      success: true,
      sessionId: id,
      action: 'replanning',
      message: 'Plan rejected, replanning with feedback'
    })
  } catch (error) {
    console.error('Failed to reject plan:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to reject plan' },
      { status: 500 }
    )
  }
}

// Background job for replanning after rejection
async function runPlanningRestartInBackground(
  sessionId: string,
  mission: string,
  projectPath: string,
  rejectionReason: string
) {
  try {
    // Load preset for capabilities
    const preset = await loadPreset(projectPath)
    const planningOptions = resolveCapabilitiesForPhase(preset, 'planning')

    // Get existing messages for context
    const existingMessages = getPlanMessages(sessionId)

    const context: PlanningContext = {
      mission,
      projectPath,
      messages: existingMessages
    }

    // Run planning phase again with the rejection context
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
    console.error(`Planning restart for session ${sessionId} failed:`, error)

    const errorEvent: PolishEvent = {
      type: 'error',
      data: { message: error instanceof Error ? error.message : 'Unknown error' }
    }
    addEvent(sessionId, errorEvent)

    updateSession(sessionId, { status: 'failed' })
  }
}
