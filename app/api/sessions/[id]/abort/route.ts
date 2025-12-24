import { NextRequest, NextResponse } from 'next/server'
import {
  getSession,
  updateSession,
  addEvent
} from '@/lib/session-store'
import type { PolishEvent } from '@/lib/types'

type RouteParams = { params: Promise<{ id: string }> }

// POST /api/sessions/[id]/abort - Abort a running session (planning or execution)
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

    // Only allow aborting sessions that are running or planning
    if (!['running', 'planning', 'awaiting_approval', 'pending'].includes(session.status)) {
      return NextResponse.json(
        { error: 'Session cannot be aborted (already completed, failed, or cancelled)' },
        { status: 400 }
      )
    }

    // Emit abort event
    const abortEvent: PolishEvent = {
      type: 'aborted',
      data: {
        reason: 'User aborted the session',
        abortedAt: new Date().toISOString()
      }
    }
    addEvent(id, abortEvent)

    // Also emit a status event for UI feedback
    const statusEvent: PolishEvent = {
      type: 'status',
      data: {
        phase: 'abort',
        message: 'Session aborted by user'
      }
    }
    addEvent(id, statusEvent)

    // Update session status
    updateSession(id, {
      status: 'cancelled',
      completedAt: new Date()
    })

    return NextResponse.json({
      success: true,
      sessionId: id,
      message: 'Session aborted successfully'
    })
  } catch (error) {
    console.error('Failed to abort session:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to abort session' },
      { status: 500 }
    )
  }
}
