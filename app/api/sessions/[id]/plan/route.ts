import { NextRequest, NextResponse } from 'next/server'
import {
  getSession,
  updateSession,
  addEvent,
  addPlanMessage,
  getPlanMessages
} from '@/lib/session-store'
import { continuePlanning, runPlanningPhase, type PlanningContext } from '@/lib/planner'
import { loadPreset } from '@/lib/scorer'
import { resolveCapabilitiesForPhase } from '@/lib/capabilities'
import type { PlanMessage, PolishEvent } from '@/lib/types'

type RouteParams = { params: Promise<{ id: string }> }

interface PlanMessageRequest {
  message: string
}

// GET /api/sessions/[id]/plan - Get plan messages
export async function GET(
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

    const messages = getPlanMessages(id)

    return NextResponse.json({
      sessionId: id,
      status: session.status,
      messages,
      approvedPlan: session.approvedPlan
    })
  } catch (error) {
    console.error('Failed to get plan messages:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to get plan messages' },
      { status: 500 }
    )
  }
}

// POST /api/sessions/[id]/plan - Send a message in the planning phase
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

    // Only allow messages during planning or awaiting_approval phases
    if (!['planning', 'awaiting_approval'].includes(session.status)) {
      return NextResponse.json(
        { error: 'Session is not in planning phase' },
        { status: 400 }
      )
    }

    // Must have a mission
    if (!session.mission) {
      return NextResponse.json(
        { error: 'Cannot plan a session without a mission' },
        { status: 400 }
      )
    }

    const body = await request.json() as PlanMessageRequest

    if (!body.message || body.message.trim().length === 0) {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      )
    }

    // Add user message
    const userMessage: PlanMessage = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: body.message.trim(),
      timestamp: new Date().toISOString()
    }
    addPlanMessage(id, userMessage)

    // Update status to planning (in case we were awaiting_approval)
    updateSession(id, { status: 'planning' })

    // Run planning continuation in background
    runPlanningContinuationInBackground(id, session.mission, session.projectPath, userMessage.content)

    return NextResponse.json({
      success: true,
      sessionId: id,
      message: 'Planning message sent'
    })
  } catch (error) {
    console.error('Failed to send plan message:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to send plan message' },
      { status: 500 }
    )
  }
}

// Background job for planning continuation
async function runPlanningContinuationInBackground(
  sessionId: string,
  mission: string,
  projectPath: string,
  userMessage: string
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

    // Continue planning with user feedback
    for await (const event of continuePlanning(context, userMessage, planningOptions)) {
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
    console.error(`Planning continuation for session ${sessionId} failed:`, error)

    const errorEvent: PolishEvent = {
      type: 'error',
      data: { message: error instanceof Error ? error.message : 'Unknown error' }
    }
    addEvent(sessionId, errorEvent)

    updateSession(sessionId, { status: 'failed' })
  }
}
