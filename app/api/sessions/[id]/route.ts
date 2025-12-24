import { NextRequest, NextResponse } from 'next/server'
import {
  getSession,
  deleteSession,
  updateSession,
  getLatestEvents
} from '@/lib/session-store'

type RouteParams = { params: Promise<{ id: string }> }

// GET /api/sessions/[id] - Get session details
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

    // Include latest events
    const events = getLatestEvents(id, 100)

    return NextResponse.json({
      session,
      events: events.map(e => ({
        id: e.id,
        type: e.type,
        data: JSON.parse(e.data),
        timestamp: e.timestamp
      }))
    })
  } catch (error) {
    console.error('Failed to get session:', error)
    return NextResponse.json(
      { error: 'Failed to get session' },
      { status: 500 }
    )
  }
}

// DELETE /api/sessions/[id] - Cancel or delete a session
export async function DELETE(
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

    // If running, mark as cancelled
    if (session.status === 'running') {
      updateSession(id, {
        status: 'cancelled',
        completedAt: new Date()
      })
      return NextResponse.json({ success: true, cancelled: true })
    }

    // Otherwise, delete from DB
    deleteSession(id)
    return NextResponse.json({ success: true, deleted: true })
  } catch (error) {
    console.error('Failed to delete session:', error)
    return NextResponse.json(
      { error: 'Failed to delete session' },
      { status: 500 }
    )
  }
}
