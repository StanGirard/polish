import { NextRequest, NextResponse } from 'next/server'
import {
  getSession,
  updateSession,
  addEvent
} from '@/lib/session-store'
import { runIsolatedPolish } from '@/lib/loop'
import type { PolishConfig, PolishEvent, ImageAttachment } from '@/lib/types'

type RouteParams = { params: Promise<{ id: string }> }

interface RetryRequest {
  feedback: string
  feedbackImages?: ImageAttachment[]
  maxDuration?: number
}

// POST /api/sessions/[id]/retry - Retry a session with feedback
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

    // Only allow retry on completed or failed sessions
    if (!['completed', 'failed'].includes(session.status)) {
      return NextResponse.json(
        { error: 'Can only retry completed or failed sessions' },
        { status: 400 }
      )
    }

    // Must have a mission to retry
    if (!session.mission) {
      return NextResponse.json(
        { error: 'Cannot retry a session without a mission' },
        { status: 400 }
      )
    }

    const body = await request.json() as RetryRequest

    if (!body.feedback || body.feedback.trim().length === 0) {
      return NextResponse.json(
        { error: 'Feedback is required for retry' },
        { status: 400 }
      )
    }

    // Update session for retry
    const newRetryCount = session.retryCount + 1
    updateSession(id, {
      status: 'running',
      retryCount: newRetryCount,
      completedAt: undefined,
      // Save the feedback
      feedback: {
        rating: 'unsatisfied',
        comment: body.feedback,
        images: body.feedbackImages ? JSON.stringify(body.feedbackImages) : undefined,
        createdAt: new Date()
      }
    })

    // Parse mission images if stored
    const missionImages = session.missionImages
      ? JSON.parse(session.missionImages) as ImageAttachment[]
      : undefined

    // Launch polish in background with feedback context
    runRetryInBackground(id, {
      projectPath: session.projectPath,
      mission: session.mission,
      missionImages,
      maxDuration: body.maxDuration || 5 * 60 * 1000,
      isolation: {
        enabled: true,
        existingBranch: session.branchName // Use existing branch if available
      },
      retry: {
        feedback: body.feedback,
        feedbackImages: body.feedbackImages,
        retryCount: newRetryCount
      }
    })

    return NextResponse.json({
      success: true,
      sessionId: id,
      retryCount: newRetryCount,
      message: `Session retry #${newRetryCount} started`
    })
  } catch (error) {
    console.error('Failed to retry session:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to retry session' },
      { status: 500 }
    )
  }
}

// Background job runner for retry
async function runRetryInBackground(sessionId: string, config: PolishConfig) {
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
    console.error(`Session retry ${sessionId} failed:`, error)

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
