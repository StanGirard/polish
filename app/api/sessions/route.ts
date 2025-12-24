import { NextRequest, NextResponse } from 'next/server'
import {
  createSession,
  getAllSessions,
  updateSession,
  addEvent,
  type Session
} from '@/lib/session-store'
import { runIsolatedPolish } from '@/lib/loop'
import type { PolishConfig, PolishEvent } from '@/lib/types'

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
      sourceBranch,
      projectPath = process.cwd(),
      maxDuration: duration = 5 * 60 * 1000
    } = body

    // Create session in DB
    const session = createSession({
      mission: mission?.trim() || undefined,
      projectPath
    })

    // Update to running
    updateSession(session.id, { status: 'running' })

    // Launch polish in background (fire and forget)
    runPolishInBackground(session.id, {
      projectPath,
      mission: mission?.trim() || undefined,
      maxDuration: duration,
      isolation: { enabled: true },
      sourceBranch: sourceBranch?.trim() || undefined
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
