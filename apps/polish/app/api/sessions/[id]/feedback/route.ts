import { NextRequest, NextResponse } from 'next/server'
import {
  getSession,
  updateSession,
  type FeedbackRating
} from '@/lib/session-store'

type RouteParams = { params: Promise<{ id: string }> }

interface FeedbackRequest {
  rating: FeedbackRating
  comment?: string
}

// POST /api/sessions/[id]/feedback - Add feedback to a session
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

    // Only allow feedback on completed or failed sessions
    if (!['completed', 'failed'].includes(session.status)) {
      return NextResponse.json(
        { error: 'Can only provide feedback on completed or failed sessions' },
        { status: 400 }
      )
    }

    const body = await request.json() as FeedbackRequest

    if (!body.rating || !['satisfied', 'unsatisfied'].includes(body.rating)) {
      return NextResponse.json(
        { error: 'Invalid rating. Must be "satisfied" or "unsatisfied"' },
        { status: 400 }
      )
    }

    updateSession(id, {
      feedback: {
        rating: body.rating,
        comment: body.comment,
        createdAt: new Date()
      }
    })

    return NextResponse.json({
      success: true,
      message: 'Feedback saved successfully'
    })
  } catch (error) {
    console.error('Failed to save feedback:', error)
    return NextResponse.json(
      { error: 'Failed to save feedback' },
      { status: 500 }
    )
  }
}
